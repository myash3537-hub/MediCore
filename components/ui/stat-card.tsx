import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function StatCard({
  title,
  value,
  helper,
  trend
}: Readonly<{
  title: string;
  value: string;
  helper: string;
  trend?: "up" | "down" | "neutral";
}>) {
  const icon =
    trend === "up" ? <ArrowUpRight className="h-4 w-4" /> : trend === "down" ? <ArrowDownRight className="h-4 w-4" /> : null;

  return (
    <Card className="group overflow-hidden p-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(32,166,99,0.12),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(38,158,162,0.12),transparent_24%)] opacity-90" />
      <div className="relative flex h-full flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{title}</p>
            <p className="mt-3 font-display text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          </div>
          {trend ? <Badge variant={trend === "down" ? "danger" : trend === "up" ? "success" : "neutral"}>{trend}</Badge> : null}
        </div>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          {icon}
          {helper}
        </p>
      </div>
    </Card>
  );
}
