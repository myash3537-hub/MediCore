"use client";

import { useState } from "react";

import { upsertMedicineAction } from "@/lib/actions/pharmacy";
import { medicineCategories } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Supplier } from "@/lib/types";

type MedicineFormValues = {
  medicine_id?: string;
  batch_id?: string;
  name?: string;
  generic_name?: string | null;
  category?: string;
  supplier_id?: string | null;
  supplier_name?: string | null;
  rx_required?: boolean;
  batch_number?: string;
  expiry_date?: string;
  stock_quantity?: number;
  purchase_price?: number;
  selling_price?: number;
  tablets_per_strip?: number;
  low_stock_threshold?: number;
  low_stock_alert_enabled?: boolean;
  sku?: string | null;
  description?: string | null;
};

export function MedicineForm({
  suppliers,
  initial,
  actionLabel,
  canManagePurchasePrice
}: Readonly<{
  suppliers: Supplier[];
  initial?: MedicineFormValues;
  actionLabel: string;
  canManagePurchasePrice: boolean;
}>) {
  const [category, setCategory] = useState(initial?.category ?? medicineCategories[0]);
  const isTablet = category === "Tablet";

  return (
    <form action={upsertMedicineAction} className="grid gap-4">
      <input type="hidden" name="medicine_id" defaultValue={initial?.medicine_id ?? ""} />
      <input type="hidden" name="batch_id" defaultValue={initial?.batch_id ?? ""} />

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Medicine name</label>
          <Input name="name" required defaultValue={initial?.name ?? ""} placeholder="Paracetamol 650" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Generic name</label>
          <Input name="generic_name" defaultValue={initial?.generic_name ?? ""} placeholder="Paracetamol" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Category</label>
          <Select name="category" value={category} onChange={(event) => setCategory(event.target.value)}>
            {medicineCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Supplier</label>
          <Select name="supplier_id" defaultValue={initial?.supplier_id ?? ""}>
            <option value="">Select supplier</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Or supplier name</label>
          <Input name="supplier_name" defaultValue={initial?.supplier_name ?? ""} placeholder="Create or use supplier name" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Batch number</label>
          <Input name="batch_number" defaultValue={initial?.batch_number ?? ""} placeholder="BCH-2026-001" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Expiry date</label>
          <Input name="expiry_date" type="date" defaultValue={initial?.expiry_date ?? ""} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">{isTablet ? "Stock quantity (strips)" : "Stock quantity"}</label>
          <Input name="stock_quantity" type="number" min={0} step="0.01" defaultValue={initial?.stock_quantity ?? 0} />
        </div>
        {isTablet ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">Tablets per strip</label>
            <Input name="tablets_per_strip" type="number" min={1} step={1} defaultValue={initial?.tablets_per_strip ?? 10} />
          </div>
        ) : (
          <input type="hidden" name="tablets_per_strip" value={1} />
        )}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Low stock alert</label>
          <Input name="low_stock_threshold" type="number" min={0} defaultValue={initial?.low_stock_threshold ?? 10} />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          <input
            type="checkbox"
            name="low_stock_alert_enabled"
            defaultChecked={initial?.low_stock_alert_enabled ?? true}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          Show low stock alert for this medicine
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {canManagePurchasePrice ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-800">Purchase price</label>
            <Input name="purchase_price" type="number" min={0} step="0.01" defaultValue={initial?.purchase_price ?? 0} />
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
            Purchase price is hidden for pharmacist accounts and can only be created or changed by admins.
          </div>
        )}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Selling price</label>
          <Input name="selling_price" type="number" min={0} step="0.01" defaultValue={initial?.selling_price ?? 0} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">SKU</label>
          <Input name="sku" defaultValue={initial?.sku ?? ""} placeholder="Optional internal code" />
        </div>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" name="rx_required" defaultChecked={initial?.rx_required ?? false} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Prescription required
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Description</label>
        <Textarea name="description" defaultValue={initial?.description ?? ""} placeholder="Optional medicine notes or usage information" />
      </div>

      <Button type="submit" variant="success">
        {actionLabel}
      </Button>
    </form>
  );
}
