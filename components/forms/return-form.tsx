"use client";

import { useDeferredValue, useState } from "react";
import { CornerUpLeft, Search } from "lucide-react";

import { recordSaleReturnAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

type SaleItemCandidate = {
  id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  batch_id: string;
  medicine_id: string;
  medicines?: { name?: string | null } | null;
  medicine_batches?: { batch_number?: string | null } | null;
};

type SaleCandidate = {
  id: string;
  invoice_number: string;
  customer_name?: string | null;
  total_amount: number;
  sale_date: string;
  sale_items: SaleItemCandidate[];
};

type ReturnItemState = Record<string, { quantity: number; refund_amount: number }>;

export function ReturnForm({
  sales
}: Readonly<{
  sales: Array<Record<string, unknown>>;
}>) {
  const saleList = sales as unknown as SaleCandidate[];
  const [search, setSearch] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState(saleList[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [itemsState, setItemsState] = useState<ReturnItemState>({});

  const filteredSales = saleList
    .filter((sale) => {
      const needle = deferredSearch.toLowerCase();
      return sale.invoice_number.toLowerCase().includes(needle) || (sale.customer_name ?? "").toLowerCase().includes(needle);
    })
    .slice(0, 8);

  const selectedSale = saleList.find((sale) => sale.id === selectedSaleId) ?? filteredSales[0];
  const selectedItems = selectedSale?.sale_items ?? [];

  const refundAmount = selectedItems.reduce((total, item) => total + (itemsState[item.id]?.refund_amount ?? 0), 0);

  function updateItem(itemId: string, patch: Partial<{ quantity: number; refund_amount: number }>) {
    setItemsState((current) => ({
      ...current,
      [itemId]: {
        quantity: current[itemId]?.quantity ?? 0,
        refund_amount: current[itemId]?.refund_amount ?? 0,
        ...patch
      }
    }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="space-y-5 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Return lookup</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-slate-950">Find a past invoice</h3>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search invoice number or customer..." className="pl-11" />
        </div>

        <div className="grid gap-3">
          {filteredSales.map((sale) => (
            <button
              key={sale.id}
              type="button"
              onClick={() => setSelectedSaleId(sale.id)}
              className={`rounded-3xl border p-4 text-left transition ${
                selectedSaleId === sale.id ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-slate-50 hover:border-brand-200"
              }`}
            >
              <p className="font-semibold text-slate-950">{sale.invoice_number}</p>
              <p className="mt-2 text-sm text-slate-600">
                {sale.customer_name || "Walk-in customer"} • {sale.sale_date.slice(0, 10)}
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">{formatCurrency(Number(sale.total_amount))}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <form action={recordSaleReturnAction} className="space-y-5">
          <input type="hidden" name="sale_id" value={selectedSale?.id ?? ""} />
          <input
            type="hidden"
            name="items_json"
            value={JSON.stringify(
              selectedItems
                .filter((item) => (itemsState[item.id]?.quantity ?? 0) > 0)
                .map((item) => ({
                  sale_item_id: item.id,
                  quantity: itemsState[item.id]?.quantity ?? 0,
                  refund_amount: itemsState[item.id]?.refund_amount ?? 0
                }))
            )}
          />
          <input type="hidden" name="refund_amount" value={refundAmount} />

          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">
              <CornerUpLeft className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-2xl font-semibold text-slate-950">Process return</h3>
              <p className="text-sm text-slate-600">Restore stock automatically and capture the refund against the original sale.</p>
            </div>
          </div>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            {selectedItems.length ? (
              selectedItems.map((item) => (
                <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{item.medicines?.name ?? "Medicine"}</p>
                      <p className="mt-2 text-sm text-slate-600">
                        Batch {item.medicine_batches?.batch_number ?? "N/A"} • Sold qty {item.quantity}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input type="number" min={0} max={item.quantity} value={itemsState[item.id]?.quantity ?? 0} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 0 })} />
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={itemsState[item.id]?.refund_amount ?? Number(item.line_total)}
                        onChange={(event) => updateItem(item.id, { refund_amount: Number(event.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-7 text-sm text-slate-500">
                Pick an invoice from the left to configure return quantities.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">Reason for return</label>
            <Textarea name="reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Damaged strip, wrong issue, customer cancellation..." />
          </div>

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Refund total</span>
              <span className="font-display text-3xl font-semibold">{formatCurrency(refundAmount)}</span>
            </div>
          </div>

          <Button type="submit" variant="success" className="w-full">
            Complete return
          </Button>
        </form>
      </section>
    </div>
  );
}
