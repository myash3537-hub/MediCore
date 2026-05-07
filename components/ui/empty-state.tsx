import { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description
}: Readonly<{
  icon: LucideIcon;
  title: string;
  description: string;
}>) {
  return (
    <Card className="border-dashed text-center">
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10">
        <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">
          <Icon className="h-6 w-6" />
        </span>
        <div className="space-y-2">
          <h3 className="font-display text-2xl font-semibold text-slate-950">{title}</h3>
          <p className="text-sm leading-6 text-slate-600">{description}</p>
        </div>
      </div>
    </Card>
  );
}

