import { cn } from "@/lib/utils";

const styles = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  success: "bg-brand-50 text-brand-800 border-brand-200",
  warning: "bg-amber-50 text-amber-800 border-amber-200",
  danger: "bg-rose-50 text-rose-700 border-rose-200",
  accent: "bg-accent-50 text-accent-800 border-accent-200"
};

export function Badge({
  children,
  variant = "neutral"
}: Readonly<{
  children: React.ReactNode;
  variant?: keyof typeof styles;
}>) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]", styles[variant])}>
      {children}
    </span>
  );
}

