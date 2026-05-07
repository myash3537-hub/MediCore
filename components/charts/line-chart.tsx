import { formatCurrency } from "@/lib/utils";

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) {
    return "";
  }

  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

export function LineChart({
  data,
  currency = "INR"
}: Readonly<{
  data: Array<{ label: string; value: number }>;
  currency?: string;
}>) {
  const width = 420;
  const height = 200;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const points = data.map((item, index) => ({
    x: (index / Math.max(data.length - 1, 1)) * width,
    y: height - (item.value / maxValue) * (height - 24) - 12
  }));

  return (
    <div className="space-y-5">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full overflow-visible">
        <defs>
          <linearGradient id="line-fill" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgba(32, 166, 99, 0.28)" />
            <stop offset="100%" stopColor="rgba(32, 166, 99, 0.02)" />
          </linearGradient>
        </defs>
        <path d={`M 0 ${height} ${buildLinePath(points)} L ${width} ${height} Z`} fill="url(#line-fill)" />
        <path d={buildLinePath(points)} fill="none" stroke="#20a663" strokeWidth="4" strokeLinecap="round" />
        {points.map((point, index) => (
          <circle key={data[index]?.label} cx={point.x} cy={point.y} r="5" fill="#0f172a" stroke="#ffffff" strokeWidth="2" />
        ))}
      </svg>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{item.label}</p>
            <p className="mt-2 text-sm font-semibold text-slate-900">{formatCurrency(item.value, currency)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

