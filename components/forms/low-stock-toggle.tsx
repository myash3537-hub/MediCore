"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { toggleLowStockAlertAction } from "@/lib/actions/pharmacy";

export function LowStockToggle({
  medicineId,
  enabled
}: Readonly<{
  medicineId: string;
  enabled: boolean;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
      <input
        type="checkbox"
        checked={enabled}
        disabled={isPending}
        onChange={(event) => {
          const nextEnabled = event.target.checked;
          startTransition(async () => {
            await toggleLowStockAlertAction(medicineId, nextEnabled);
            router.refresh();
          });
        }}
        className="h-4 w-4 rounded border-slate-300 text-brand-600"
      />
      {isPending ? "Saving..." : "Show in critical stock"}
    </label>
  );
}
