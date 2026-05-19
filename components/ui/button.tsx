import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-slate-950 text-white shadow-[0_18px_36px_rgba(15,23,42,0.18)] hover:bg-slate-800",
  secondary: "bg-white/90 text-slate-800 ring-1 ring-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.08)] hover:bg-white",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100/90",
  success: "bg-gradient-to-r from-brand-600 via-brand-500 to-accent-500 text-white shadow-[0_18px_38px_rgba(21,105,67,0.22)] hover:from-brand-700 hover:via-brand-600 hover:to-accent-600"
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
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
