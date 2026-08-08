"use client";

import { useDeferredValue, useState } from "react";
import { PackagePlus, Search, Trash2 } from "lucide-react";

import { recordPurchaseAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Supplier } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

type MedicineOption = {
  id: string;
  name: string;
  generic_name?: string | null;
  category: string;
  rx_required: boolean;
  default_supplier_id?: string | null;
};

type PurchaseRow = MedicineOption & {
  batch_number: string;
  expiry_date: string;
  quantity: number;
  purchase_price: number;
  selling_price: number;
  tablets_per_strip: number;
  low_stock_threshold: number;
};

export function PurchaseForm({
  medicines,
  suppliers,
  defaultLowStockThreshold
}: Readonly<{
  medicines: Array<Record<string, unknown>>;
  suppliers: Supplier[];
  defaultLowStockThreshold: number;
}>) {
  const catalog = medicines as MedicineOption[];
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredRows = catalog
    .filter((item) => {
      const needle = deferredSearch.toLowerCase();
      return item.name.toLowerCase().includes(needle) || (item.generic_name ?? "").toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle);
    })
    .slice(0, 10);

  const totalAmount = rows.reduce((total, item) => total + item.quantity * item.purchase_price, 0);

  function addMedicine(medicine: MedicineOption) {
    setRows((current) => {
      if (current.some((row) => row.id === medicine.id)) {
        return current;
      }

      return [
        ...current,
        {
          ...medicine,
          batch_number: "",
          expiry_date: "",
          quantity: 1,
          purchase_price: 0,
          selling_price: 0,
          tablets_per_strip: medicine.category === "Tablet" ? 10 : 1,
          low_stock_threshold: defaultLowStockThreshold
        }
      ];
    });

    if (!supplierId && medicine.default_supplier_id) {
      setSupplierId(medicine.default_supplier_id);
    }
  }

  function updateRow(id: string, patch: Partial<PurchaseRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function removeRow(id: string) {
    setRows((current) => current.filter((row) => row.id !== id));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <section className="space-y-5 rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">Purchase intake</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-slate-950">Select medicines for supplier receipt</h3>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search medicine name or category..." className="pl-11" />
        </div>

        <div className="grid gap-3">
          {filteredRows.map((medicine) => (
            <button
              key={medicine.id}
              type="button"
              onClick={() => addMedicine(medicine)}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-950">{medicine.name}</p>
                  {medicine.generic_name ? <p className="mt-1 text-sm font-medium text-brand-700">{medicine.generic_name}</p> : null}
                  <p className="mt-2 text-sm text-slate-600">{medicine.category}</p>
                </div>
                <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-800">
                  Add
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-soft">
        <form action={recordPurchaseAction} className="space-y-5">
          <input
            type="hidden"
            name="items_json"
            value={JSON.stringify(
              rows.map((row) => ({
                medicine_id: row.id,
                supplier_id: supplierId || null,
                batch_number: row.batch_number,
                expiry_date: row.expiry_date,
                quantity: row.quantity,
                purchase_price: row.purchase_price,
                selling_price: row.selling_price,
                tablets_per_strip: row.category === "Tablet" ? row.tablets_per_strip : 1,
                low_stock_threshold: row.low_stock_threshold
              }))
            )}
          />

          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-accent-50 text-accent-700">
              <PackagePlus className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-2xl font-semibold text-slate-950">Supplier receipt</h3>
              <p className="text-sm text-slate-600">Capture invoice details, batch numbers, prices, and expiry in one flow.</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Supplier</label>
              <Select name="supplier_id" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Or create supplier</label>
              <Input name="supplier_name" value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="New supplier name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Invoice number</label>
              <Input name="invoice_number" value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Supplier bill reference" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-800">Purchase date</label>
              <Input name="purchase_date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
            </div>
          </div>

          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
            {rows.length ? (
              rows.map((row) => (
                <div key={row.id} className="rounded-3xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">{row.name}</p>
                      {row.generic_name ? <p className="mt-1 text-sm font-medium text-brand-700">{row.generic_name}</p> : null}
                      <p className="mt-2 text-sm text-slate-600">{row.category}</p>
                    </div>
                    <button type="button" onClick={() => removeRow(row.id)} className="rounded-2xl p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Input placeholder="Batch number" value={row.batch_number} onChange={(event) => updateRow(row.id, { batch_number: event.target.value })} />
                    <Input type="date" value={row.expiry_date} onChange={(event) => updateRow(row.id, { expiry_date: event.target.value })} />
                    <Input type="number" min={0.01} step="0.01" value={row.quantity} onChange={(event) => updateRow(row.id, { quantity: Number(event.target.value) || 1 })} />
                    <Input type="number" min={0} step="0.01" value={row.purchase_price} onChange={(event) => updateRow(row.id, { purchase_price: Number(event.target.value) || 0 })} />
                    <Input type="number" min={0} step="0.01" value={row.selling_price} onChange={(event) => updateRow(row.id, { selling_price: Number(event.target.value) || 0 })} />
                    {row.category === "Tablet" ? (
                      <Input type="number" min={1} step={1} value={row.tablets_per_strip} onChange={(event) => updateRow(row.id, { tablets_per_strip: Math.max(1, Math.round(Number(event.target.value) || 10)) })} />
                    ) : null}
                    <Input type="number" min={0} value={row.low_stock_threshold} onChange={(event) => updateRow(row.id, { low_stock_threshold: Number(event.target.value) || defaultLowStockThreshold })} />
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-7 text-sm text-slate-500">
                Search and add medicines from the catalog to build this purchase receipt.
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">Notes</label>
            <Textarea name="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional remarks about the purchase" />
          </div>

          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="text-sm uppercase tracking-[0.2em] text-slate-300">Total purchase</span>
              <span className="font-display text-3xl font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
          </div>

          <Button type="submit" variant="success" className="w-full">
            Record purchase
          </Button>
        </form>
      </section>
    </div>
  );
}
