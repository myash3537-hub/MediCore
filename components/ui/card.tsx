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
    <section {...props} className={cn("rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft", className)}>
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
        <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
