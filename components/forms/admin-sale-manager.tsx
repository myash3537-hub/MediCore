"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, PencilLine, Trash2 } from "lucide-react";

import { deleteSaleAction, updateSaleAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { OnlinePaymentMethod, PaymentMethod } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type EditableSaleItem = {
  id: string;
  medicine_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  medicines?: { name?: string | null } | null;
  medicine_batches?: { batch_number?: string | null } | null;
};

type EditableSale = {
  id: string;
  invoice_number: string;
  sale_date: string;
  customer_name?: string | null;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  cash_amount?: number;
  online_amount?: number;
  online_payment_method?: OnlinePaymentMethod | null;
  notes?: string | null;
  sale_items: EditableSaleItem[];
};

const paymentMethods: PaymentMethod[] = ["Cash", "UPI", "Card", "Split"];
const onlinePaymentMethods: OnlinePaymentMethod[] = ["UPI", "Card"];

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

export function AdminSaleManager({
  sales,
  currency
}: Readonly<{
  sales: Array<Record<string, unknown>>;
  currency: string;
}>) {
  const [editableSales, setEditableSales] = useState<EditableSale[]>(
    (sales as unknown as EditableSale[]).map((sale) => ({
      ...sale,
      subtotal: Number(sale.subtotal ?? 0),
      discount_amount: Number(sale.discount_amount ?? 0),
      tax_amount: Number(sale.tax_amount ?? 0),
      total_amount: Number(sale.total_amount ?? 0),
      cash_amount: Number(sale.cash_amount ?? 0),
      online_amount: Number(sale.online_amount ?? 0),
      sale_items: (sale.sale_items ?? []).map((item) => ({
        ...item,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        line_total: Number(item.line_total ?? 0)
      }))
    }))
  );

  function updateSale(saleId: string, patch: Partial<EditableSale>) {
    setEditableSales((current) => current.map((sale) => (sale.id === saleId ? { ...sale, ...patch } : sale)));
  }

  function updateSaleItem(saleId: string, itemId: string, patch: Partial<EditableSaleItem>) {
    setEditableSales((current) =>
      current.map((sale) =>
        sale.id === saleId
          ? {
              ...sale,
              sale_items: sale.sale_items.map((item) => (item.id === itemId ? { ...item, ...patch } : item))
            }
          : sale
      )
    );
  }

  const totalsBySaleId = useMemo(() => {
    return new Map(
      editableSales.map((sale) => {
        const subtotal = toMoney(sale.sale_items.reduce((total, item) => total + item.quantity * item.unit_price, 0));
        const totalAmount = toMoney(Math.max(subtotal - sale.discount_amount + sale.tax_amount, 0));
        const splitDifference = toMoney(totalAmount - ((sale.cash_amount ?? 0) + (sale.online_amount ?? 0)));
        const splitValid =
          sale.payment_method !== "Split" ||
          (Math.abs(splitDifference) <= 0.01 &&
            (totalAmount === 0 || ((sale.cash_amount ?? 0) > 0 && (sale.online_amount ?? 0) > 0)) &&
            !!sale.online_payment_method);

        return [
          sale.id,
          {
            subtotal,
            totalAmount,
            splitValid,
            splitDifference
          }
        ];
      })
    );
  }, [editableSales]);

  return (
    <div className="space-y-4">
      {editableSales.map((sale) => {
        const totals = totalsBySaleId.get(sale.id);

        return (
          <details key={sale.id} className="group rounded-[28px] border border-slate-200 bg-white shadow-soft">
            <summary className="flex cursor-pointer list-none flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Admin invoice editor</p>
                <h3 className="mt-2 font-display text-xl font-semibold text-slate-950">{sale.invoice_number}</h3>
                <p className="mt-2 text-sm text-slate-600">
                  {sale.customer_name || "Walk-in customer"} • {sale.sale_date.slice(0, 10)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{formatCurrency(totals?.totalAmount ?? sale.total_amount, currency)}</span>
                <PencilLine className="h-5 w-5 text-brand-700 transition group-open:rotate-90" />
              </div>
            </summary>

            <div className="border-t border-slate-200 px-6 py-6">
              <form action={updateSaleAction} className="space-y-5">
                <input type="hidden" name="sale_id" value={sale.id} />
                <input
                  type="hidden"
                  name="items_json"
                  value={JSON.stringify(
                    sale.sale_items.map((item) => ({
                      id: item.id,
                      medicine_id: item.medicine_id,
                      batch_id: item.batch_id,
                      quantity: item.quantity,
                      unit_price: item.unit_price
                    }))
                  )}
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Customer name</label>
                    <Input value={sale.customer_name ?? ""} onChange={(event) => updateSale(sale.id, { customer_name: event.target.value })} name="customer_name" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Payment method</label>
                    <Select value={sale.payment_method} name="payment_method" onChange={(event) => updateSale(sale.id, { payment_method: event.target.value as PaymentMethod })}>
                      {paymentMethods.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                {sale.payment_method === "Split" ? (
                  <div className="grid gap-4 md:grid-cols-3 rounded-3xl border border-brand-100 bg-brand-50 p-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-800">Cash amount</label>
                      <Input type="number" min={0} step="0.01" name="cash_amount" value={sale.cash_amount ?? 0} onChange={(event) => updateSale(sale.id, { cash_amount: Number(event.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-800">Online amount</label>
                      <Input type="number" min={0} step="0.01" name="online_amount" value={sale.online_amount ?? 0} onChange={(event) => updateSale(sale.id, { online_amount: Number(event.target.value) || 0 })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-800">Online type</label>
                      <Select value={sale.online_payment_method ?? "UPI"} name="online_payment_method" onChange={(event) => updateSale(sale.id, { online_payment_method: event.target.value as OnlinePaymentMethod })}>
                        {onlinePaymentMethods.map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ) : (
                  <>
                    <input type="hidden" name="cash_amount" value={sale.payment_method === "Cash" ? totals?.totalAmount ?? 0 : 0} />
                    <input type="hidden" name="online_amount" value={sale.payment_method === "Cash" ? 0 : totals?.totalAmount ?? 0} />
                    <input type="hidden" name="online_payment_method" value={sale.payment_method === "UPI" || sale.payment_method === "Card" ? sale.payment_method : ""} />
                  </>
                )}

                <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                  {sale.sale_items.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <p className="font-semibold text-slate-950">{item.medicines?.name ?? "Medicine"}</p>
                          <p className="mt-2 text-sm text-slate-600">Batch {item.medicine_batches?.batch_number ?? "N/A"}</p>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input type="number" min={0.01} step="0.01" value={item.quantity} onChange={(event) => updateSaleItem(sale.id, item.id, { quantity: Number(event.target.value) || 0.01 })} />
                          <Input type="number" min={0} step="0.01" value={item.unit_price} onChange={(event) => updateSaleItem(sale.id, item.id, { unit_price: Number(event.target.value) || 0 })} />
                          <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
                            {formatCurrency(item.quantity * item.unit_price, currency)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Discount</label>
                    <Input type="number" min={0} step="0.01" name="discount_amount" value={sale.discount_amount} onChange={(event) => updateSale(sale.id, { discount_amount: Number(event.target.value) || 0 })} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-800">Tax</label>
                    <Input type="number" min={0} step="0.01" name="tax_amount" value={sale.tax_amount} onChange={(event) => updateSale(sale.id, { tax_amount: Number(event.target.value) || 0 })} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Notes</label>
                  <Textarea name="notes" value={sale.notes ?? ""} onChange={(event) => updateSale(sale.id, { notes: event.target.value })} />
                </div>

                <div className="rounded-3xl bg-slate-950 p-5 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Updated subtotal</span>
                    <span>{formatCurrency(totals?.subtotal ?? 0, currency)}</span>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                    <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Updated total</span>
                    <span className="font-display text-3xl font-semibold">{formatCurrency(totals?.totalAmount ?? 0, currency)}</span>
                  </div>
                  <p className="mt-4 text-sm text-slate-300">Item quantities are editable to two decimal places. After saving, the invoice PDF uses the updated values automatically.</p>
                </div>

                {sale.payment_method === "Split" && !totals?.splitValid ? (
                  <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                    Split payment is invalid. The cash and online values must add up to {formatCurrency(totals?.totalAmount ?? 0, currency)}.
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" variant="success" disabled={sale.payment_method === "Split" && !totals?.splitValid}>
                    Update sale and invoice
                  </Button>
                  <Link href={`/api/invoice/${sale.id}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-800">
                    <Download className="h-4 w-4" />
                    Download PDF
                  </Link>
                </div>
              </form>

              <form action={deleteSaleAction} className="mt-4">
                <input type="hidden" name="sale_id" value={sale.id} />
                <Button
                  type="submit"
                  variant="secondary"
                  onClick={(event) => {
                    if (!window.confirm(`Delete sale ${sale.invoice_number}? Stock will be restored.`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete sale
                </Button>
              </form>
            </div>
          </details>
        );
      })}
    </div>
  );
}
