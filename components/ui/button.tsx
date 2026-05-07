import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-slate-950 text-white hover:bg-slate-800",
  secondary: "bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  success: "bg-brand-600 text-white hover:bg-brand-700"
};

export function Button({
  children,
  className,
  type = "button",
  variant = "primary",
  ...props
}: Readonly<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
}>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
