import { cn } from "@/lib/utils";

export function Table({
  children,
  className
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className={cn("min-w-full border-separate border-spacing-y-3", className)}>{children}</table>
    </div>
  );
}

export function TableHead({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <thead className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{children}</thead>;
}

export function TableBody({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <tbody>{children}</tbody>;
}

export function TableRow({
  children,
  className
}: Readonly<{
  children: React.ReactNode;
  className?: string;
}>) {
  return <tr className={cn("rounded-3xl border border-white/70 bg-white/[0.74] text-sm text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.05)]", className)}>{children}</tr>;
}

export function TableHeaderCell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <th className="pb-2 pl-4 pr-4 font-medium">{children}</th>;
}

export function TableCell({
  children,
  className,
  ...props
}: Readonly<React.ComponentPropsWithoutRef<"td">>) {
  return (
    <td className={cn("px-4 py-4 align-middle first:rounded-l-3xl last:rounded-r-3xl", className)} {...props}>
      {children}
    </td>
  );
}
