import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
  ...props
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}> &
  React.HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={cn(
        "relative overflow-hidden rounded-[30px] border border-white/[0.85] bg-white/[0.78] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.1)] backdrop-blur-xl before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand-400/90 before:to-transparent before:content-['']",
        className
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  description,
  action
}: Readonly<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}>) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[0.95rem]">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
