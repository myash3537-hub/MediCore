"use client";

import { useMemo, useState } from "react";
import { PencilLine, Trash2 } from "lucide-react";

import { deleteSaleReturnAction, updateSaleReturnAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency, formatPreciseQuantity } from "@/lib/utils";

type EditableReturnItem = {
  id: string;
  sale_item_id: string;
  batch_id: string;
  quantity: number;
  refund_amount: number;
  sale_items?: {
    quantity?: number;
    unit_price?: number;
    medicines?: { name?: string | null } | null;
    medicine_batches?: { batch_number?: string | null } | null;
  } | null;
};

type EditableReturn = {
  id: string;
  refund_amount: number;
  reason?: string | null;
  return_date: string;
  sale_id: string;
  sales?: { invoice_number?: string | null; customer_name?: string | null } | null;
  sale_return_items: EditableReturnItem[];
};

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export function AdminReturnManager({
  returns,
  currency
}: Readonly<{
  returns: Array<Record<string, unknown>>;
  currency: string;
}>) {
  const [editableReturns, setEditableReturns] = useState<EditableReturn[]>(
    (returns as unknown as EditableReturn[]).map((entry) => ({
      ...entry,
      refund_amount: Number(entry.refund_amount ?? 0),
      sale_return_items: (entry.sale_return_items ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        refund_amount: Number(item.refund_amount ?? 0)
      }))
    }))
  );

  function updateReturn(returnId: string, patch: Partial<EditableReturn>) {
    setEditableReturns((current) => current.map((entry) => (entry.id === returnId ? { ...entry, ...patch } : entry)));
  }

  function updateReturnItem(returnId: string, itemId: string, patch: Partial<EditableReturnItem>) {
    setEditableReturns((current) =>
      current.map((entry) =>
        entry.id === returnId
          ? {
              ...entry,
              sale_return_items: entry.sale_return_items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
            }
          : entry
      )
    );
  }

  const totalsByReturnId = useMemo(() => {
    return new Map(
      editableReturns.map((entry) => [
        entry.id,
        toMoney(entry.sale_return_items.reduce((total, item) => total + (item.quantity > 0 ? item.refund_amount : 0), 0))
      ])
    );
  }, [editableReturns]);

  return (
    <div className="space-y-4">
      {editableReturns.map((entry) => {
        const refundTotal = totalsByReturnId.get(entry.id) ?? 0;

        return (
          <details key={entry.id} className="group rounded-[28px] border border-slate-200 bg-white shadow-soft">
            <summary className="flex cursor-pointer list-none flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Admin return editor</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">{entry.sales?.invoice_number ?? "Return"}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {entry.sales?.customer_name || "Walk-in customer"} • {entry.return_date.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{formatCurrency(refundTotal, currency)}</span>
                <PencilLine className="h-5 w-5 text-brand-700 transition group-open:rotate-90" />
              </div>
            </summary>

            <div className="border-t border-slate-200 px-6 py-6">
              <form action={updateSaleReturnAction} className="space-y-5">
                <input type="hidden" name="sale_return_id" value={entry.id} />
                <input
                  type="hidden"
                  name="items_json"
                  value={JSON.stringify(
                    entry.sale_return_items.map((item) => ({
                      id: item.id,
                      sale_item_id: item.sale_item_id,
                      batch_id: item.batch_id,
                      quantity: item.quantity,
                      refund_amount: item.refund_amount
                    }))
                  )}
                />

                <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                  {entry.sale_return_items.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{item.sale_items?.medicines?.name ?? "Medicine"}</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Batch {item.sale_items?.medicine_batches?.batch_number ?? "N/A"} • Sold qty {formatPreciseQuantity(Number(item.sale_items?.quantity ?? 0))}
                          </p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input type="number" min={0} step="0.01" value={item.quantity} onChange={(event) => updateReturnItem(entry.id, item.id, { quantity: Number(event.target.value) || 0 })} />
                          <Input type="number" min={0} step="0.01" value={item.refund_amount} onChange={(event) => updateReturnItem(entry.id, item.id, { refund_amount: Number(event.target.value) || 0 })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Reason</label>
                  <Textarea value={entry.reason ?? ""} name="reason" onChange={(event) => updateReturn(entry.id, { reason: event.target.value })} />
                </div>

                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Updated refund</span>
                    <span className="font-display text-3xl font-semibold">{formatCurrency(refundTotal, currency)}</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-300">Return quantities also accept two decimal places here for admin corrections.</p>
                </div>

                <Button type="submit" variant="success">
                  Update return
                </Button>
              </form>

              <form action={deleteSaleReturnAction} className="mt-4">
                <input type="hidden" name="sale_return_id" value={entry.id} />
                <Button
                  type="submit"
                  variant="secondary"
                  onClick={(event) => {
                    if (!window.confirm(`Delete return for invoice ${entry.sales?.invoice_number ?? "sale"}? Stock will be adjusted back.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete return
                </Button>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
