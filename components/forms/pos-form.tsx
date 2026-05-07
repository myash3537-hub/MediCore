"use client";

import { useDeferredValue, useEffect, useState } from "react";
import { AlertTriangle, Minus, Pill, Plus, ReceiptText, Search, Trash2 } from "lucide-react";

import { recordSaleAction } from "@/lib/actions/pharmacy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { InventorySnapshotRow, OnlinePaymentMethod, PaymentMethod, StoreSettings } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type CartItem = InventorySnapshotRow & {
  quantity: number;
};

const paymentMethods: PaymentMethod[] = ["Cash", "UPI", "Card", "Split"];
const onlinePaymentMethods: OnlinePaymentMethod[] = ["UPI", "Card"];

export function PosForm({
  stockRows,
  settings
}: Readonly<{
  stockRows: InventorySnapshotRow[];
  settings: StoreSettings | null;
}>) {
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Cash");
  const [cashAmount, setCashAmount] = useState(0);
  const [onlineAmount, setOnlineAmount] = useState(0);
  const [onlinePaymentMethod, setOnlinePaymentMethod] = useState<OnlinePaymentMethod>("UPI");
  const [discountAmount, setDiscountAmount] = useState(0);
  const [manualTax, setManualTax] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  const deferredSearch = useDeferredValue(search);
  const availableRows = stockRows.filter((row) => row.stock_quantity > 0 && new Date(row.expiry_date) >= new Date());
  const filteredRows = availableRows
    .filter((row) => {
      const needle = deferredSearch.toLowerCase();
      return (
        row.medicine_name.toLowerCase().includes(needle) ||
        row.batch_number.toLowerCase().includes(needle) ||
        row.category.toLowerCase().includes(needle) ||
        (row.supplier_name ?? "").toLowerCase().includes(needle)
      );
    })
    .slice(0, 8);

  const subtotal = cart.reduce((total, item) => total + item.quantity * item.selling_price, 0);
  const autoTax = settings?.tax_enabled ? Number((((subtotal - discountAmount) * settings.tax_rate) / 100).toFixed(2)) : 0;
  const taxAmount = manualTax ?? autoTax;
  const totalAmount = Math.max(subtotal - discountAmount + taxAmount, 0);
  const isSplitPayment = paymentMethod === "Split";

  useEffect(() => {
    if (paymentMethod === "Cash") {
      setCashAmount(totalAmount);
      setOnlineAmount(0);
      return;
    }

    if (paymentMethod === "UPI" || paymentMethod === "Card") {
      setCashAmount(0);
      setOnlineAmount(totalAmount);
      setOnlinePaymentMethod(paymentMethod);
      return;
    }

    const halfAmount = Number((totalAmount / 2).toFixed(2));
    setCashAmount(halfAmount);
    setOnlineAmount(Number((totalAmount - halfAmount).toFixed(2)));
  }, [paymentMethod, totalAmount]);

  const splitDifference = Number((totalAmount - (cashAmount + onlineAmount)).toFixed(2));
  const splitValid = !isSplitPayment || (Math.abs(splitDifference) <= 0.01 && (totalAmount === 0 || (cashAmount > 0 && onlineAmount > 0)));

  function addToCart(item: InventorySnapshotRow) {
    setCart((currentCart) => {
      const existing = currentCart.find((entry) => entry.batch_id === item.batch_id);

      if (existing) {
        return currentCart.map((entry) =>
          entry.batch_id === item.batch_id
            ? {
                ...entry,
                quantity: Math.min(entry.quantity + 1, entry.stock_quantity)
              }
            : entry
        );
      }

      return [
        ...currentCart,
        {
          ...item,
          quantity: 1
        }
      ];
    });
  }

  function updateQuantity(batchId: string, value: number) {
    setCart((currentCart) =>
      currentCart.map((entry) =>
        entry.batch_id === batchId
          ? {
              ...entry,
              quantity: Math.max(1, Math.min(value || 1, entry.stock_quantity))
            }
          : entry
      )
    );
  }

  function removeItem(batchId: string) {
    setCart((currentCart) => currentCart.filter((entry) => entry.batch_id !== batchId));
  }

  function incrementQuantity(batchId: string) {
    const currentItem = cart.find((entry) => entry.batch_id === batchId);
    if (!currentItem) {
      return;
    }

    updateQuantity(batchId, currentItem.quantity + 1);
  }

  function decrementQuantity(batchId: string) {
    const currentItem = cart.find((entry) => entry.batch_id === batchId);
    if (!currentItem) {
      return;
    }

    updateQuantity(batchId, currentItem.quantity - 1);
  }

  function splitEvenly() {
    const halfAmount = Number((totalAmount / 2).toFixed(2));
    setCashAmount(halfAmount);
    setOnlineAmount(Number((totalAmount - halfAmount).toFixed(2)));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-5 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Search-first POS</p>
            <h3 className="mt-2 font-display text-2xl font-semibold text-slate-950">Add medicines to the bill</h3>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            Barcode is intentionally disabled. Search by medicine, batch, or supplier.
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search medicine, batch number, category, supplier..."
            className="pl-11"
          />
        </div>

        <div className="grid gap-3">
          {filteredRows.map((item) => (
            <button
              key={item.batch_id}
              type="button"
              onClick={() => addToCart(item)}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-950">{item.medicine_name}</p>
                    {item.rx_required ? <Badge variant="warning">Rx</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {item.category} • Batch {item.batch_number} • Expires {item.expiry_date}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.selling_price)}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">{item.stock_quantity} in stock</p>
                </div>
              </div>
            </button>
          ))}

          {!filteredRows.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-7 text-sm text-slate-500">
              No matching stock was found. Try a medicine name, supplier, or batch number.
            </div>
          ) : null}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <form action={recordSaleAction} className="space-y-5">
          <input
            type="hidden"
            name="items_json"
            value={JSON.stringify(
              cart.map((item) => ({
                medicine_id: item.medicine_id,
                batch_id: item.batch_id,
                quantity: item.quantity,
                unit_price: item.selling_price
              }))
            )}
          />
          <input type="hidden" name="discount_amount" value={discountAmount} />
          <input type="hidden" name="tax_amount" value={taxAmount} />
          <input type="hidden" name="cash_amount" value={paymentMethod === "Cash" ? totalAmount : paymentMethod === "Split" ? cashAmount : 0} />
          <input type="hidden" name="online_amount" value={paymentMethod === "Cash" ? 0 : paymentMethod === "Split" ? onlineAmount : totalAmount} />
          <input
            type="hidden"
            name="online_payment_method"
            value={paymentMethod === "Split" ? onlinePaymentMethod : paymentMethod === "UPI" || paymentMethod === "Card" ? paymentMethod : ""}
          />

          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-brand-50 text-brand-700">
              <ReceiptText className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-2xl font-semibold text-slate-950">Current bill</h3>
              <p className="text-sm text-slate-600">Review cart lines, payment, taxes, and notes before checkout.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Customer name</label>
              <Input name="customer_name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Optional" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Payment method</label>
              <Select name="payment_method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                {paymentMethods.map((method) => (
                  <option key={method} value={method}>
                    {method}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {isSplitPayment ? (
            <div className="space-y-4 rounded-3xl border border-brand-100 bg-brand-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-900">Split payment</p>
                  <p className="mt-1 text-sm text-brand-800">Take part of the payment in cash and the rest online.</p>
                </div>
                <button
                  type="button"
                  onClick={splitEvenly}
                  className="inline-flex h-10 items-center justify-center rounded-2xl border border-brand-200 bg-white px-4 text-sm font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  Split evenly
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Cash amount</label>
                  <Input type="number" min={0} step="0.01" value={cashAmount} onChange={(event) => setCashAmount(Number(event.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Online amount</label>
                  <Input type="number" min={0} step="0.01" value={onlineAmount} onChange={(event) => setOnlineAmount(Number(event.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-800">Online type</label>
                  <Select value={onlinePaymentMethod} onChange={(event) => setOnlinePaymentMethod(event.target.value as OnlinePaymentMethod)}>
                    {onlinePaymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className={`rounded-2xl px-4 py-3 text-sm font-medium ${splitValid ? "bg-white text-brand-900" : "bg-rose-50 text-rose-900"}`}>
                {splitValid
                  ? `Split ready: Cash ${formatCurrency(cashAmount, settings?.currency_code ?? "INR")} + ${onlinePaymentMethod} ${formatCurrency(onlineAmount, settings?.currency_code ?? "INR")}`
                  : `Cash and online amounts must add up to ${formatCurrency(totalAmount, settings?.currency_code ?? "INR")}. Remaining difference: ${formatCurrency(splitDifference, settings?.currency_code ?? "INR")}`}
              </div>
            </div>
          ) : null}

          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            {cart.length ? (
              cart.map((item) => (
                <div key={item.batch_id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Pill className="h-4 w-4 text-brand-700" />
                        <p className="truncate font-semibold text-slate-950">{item.medicine_name}</p>
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        Batch {item.batch_number} • Expires {item.expiry_date}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => decrementQuantity(item.batch_id)}
                          disabled={item.quantity <= 1}
                          className="flex h-12 w-12 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Decrease quantity of ${item.medicine_name}`}
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <div className="flex min-w-[4.5rem] flex-col items-center justify-center border-x border-slate-200 px-3 py-2 text-center">
                          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Qty</span>
                          <span className="text-lg font-semibold text-slate-950">{item.quantity}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => incrementQuantity(item.batch_id)}
                          disabled={item.quantity >= item.stock_quantity}
                          className="flex h-12 w-12 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:text-slate-300"
                          aria-label={`Increase quantity of ${item.medicine_name}`}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="min-w-[96px] text-right text-sm font-semibold text-slate-950">
                        {formatCurrency(item.quantity * item.selling_price)}
                      </div>
                      <button type="button" onClick={() => removeItem(item.batch_id)} className="rounded-2xl p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-7 text-sm text-slate-500">
                Start typing in the search box to add medicines to the bill.
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Discount amount</label>
              <Input type="number" min={0} step="0.01" value={discountAmount} onChange={(event) => setDiscountAmount(Number(event.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Tax amount</label>
              <Input type="number" min={0} step="0.01" value={taxAmount} onChange={(event) => setManualTax(Number(event.target.value) || 0)} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">Billing notes</label>
            <Textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional instructions or customer note" />
          </div>

          {cart.some((item) => item.rx_required) ? (
            <div className="flex items-start gap-3 rounded-3xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              At least one cart item is marked as prescription-required. Verify the prescription before completing the sale.
            </div>
          ) : null}

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Subtotal</span>
                <span>{formatCurrency(subtotal, settings?.currency_code ?? "INR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Discount</span>
                <span>{formatCurrency(discountAmount, settings?.currency_code ?? "INR")}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-300">Tax</span>
                <span>{formatCurrency(taxAmount, settings?.currency_code ?? "INR")}</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Amount due</span>
              <span className="font-display text-3xl font-semibold">{formatCurrency(totalAmount, settings?.currency_code ?? "INR")}</span>
            </div>
          </div>

          <Button type="submit" className="w-full" variant="success" disabled={!cart.length || !splitValid}>
            Complete sale
          </Button>
        </form>
      </section>
    </div>
  );
}
