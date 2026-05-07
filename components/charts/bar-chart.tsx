import { formatNumber } from "@/lib/utils";

export function BarChart({
  data
}: Readonly<{
  data: Array<{ label: string; value: number }>;
}>) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="space-y-4">
      {data.map((item) => (
        <div key={item.label} className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate pr-3 text-sm font-medium text-slate-700">{item.label}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{formatNumber(item.value)}</p>
          </div>
          <div className="h-3 rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-accent-400 via-brand-500 to-brand-700"
              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
