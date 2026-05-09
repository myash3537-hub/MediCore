import { AlertTriangle, Archive, Boxes, CircleAlert, CircleCheckBig, Info, PencilLine } from "lucide-react";

import { archiveMedicineAction } from "@/lib/actions/pharmacy";
import { MedicineForm } from "@/components/forms/medicine-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { requireAuthenticated } from "@/lib/auth";
import { getInventorySnapshot, getStoreSettings, getSuppliers } from "@/lib/data/pharmacy";
import { InventorySnapshotRow } from "@/lib/types";
import { formatCurrency, formatQuantity } from "@/lib/utils";

type InventoryGroup = {
  medicine_id: string;
  medicine_name: string;
  category: string;
  rx_required: boolean;
  total_stock_quantity: number;
  low_stock_batches: number;
  batches: InventorySnapshotRow[];
};

function formatPriceRange(values: number[], currency: string) {
  const sortedValues = Array.from(new Set(values)).sort((left, right) => left - right);

  if (!sortedValues.length) {
    return formatCurrency(0, currency);
  }

  if (sortedValues.length === 1) {
    return formatCurrency(sortedValues[0], currency);
  }

  return `${formatCurrency(sortedValues[0], currency)} to ${formatCurrency(sortedValues[sortedValues.length - 1], currency)}`;
}

function groupInventoryRows(rows: InventorySnapshotRow[]) {
  const groups = new Map<string, InventoryGroup>();

  rows.forEach((row) => {
    const existing = groups.get(row.medicine_id);

    if (existing) {
      existing.total_stock_quantity += row.stock_quantity;
      existing.low_stock_batches += row.is_low_stock ? 1 : 0;
      existing.batches.push(row);
      return;
    }

    groups.set(row.medicine_id, {
      medicine_id: row.medicine_id,
      medicine_name: row.medicine_name,
      category: row.category,
      rx_required: row.rx_required,
      total_stock_quantity: row.stock_quantity,
      low_stock_batches: row.is_low_stock ? 1 : 0,
      batches: [row]
    });
  });

  return Array.from(groups.values());
}

export default async function InventoryPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    info?: string;
    success?: string;
  };
}) {
  const { profile } = await requireAuthenticated();
  const [inventoryRows, suppliers, settings] = await Promise.all([getInventorySnapshot(), getSuppliers(), getStoreSettings()]);
  const currency = settings?.currency_code ?? "INR";
  const canManagePurchasePrice = profile.role === "admin";
  const inventoryGroups = groupInventoryRows(inventoryRows);

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <Card className="bg-rose-50">
          <div className="flex items-center gap-3 text-sm font-semibold text-rose-900">
            <CircleAlert className="h-5 w-5 text-rose-700" />
            {decodeURIComponent(searchParams.error)}
          </div>
        </Card>
      ) : null}

      {searchParams?.info ? (
        <Card className="bg-amber-50">
          <div className="flex items-center gap-3 text-sm font-semibold text-amber-900">
            <Info className="h-5 w-5 text-amber-700" />
            {decodeURIComponent(searchParams.info)}
          </div>
        </Card>
      ) : null}

      {searchParams?.success ? (
        <Card className="bg-brand-50">
          <div className="flex items-center gap-3 text-sm font-semibold text-brand-900">
            <CircleCheckBig className="h-5 w-5 text-brand-700" />
            {decodeURIComponent(searchParams.success)}
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Add or update medicine stock"
          description={
            canManagePurchasePrice
              ? "Create a new medicine, attach a batch, and configure stock, expiry, purchase cost, selling price, supplier, and prescription rules."
              : "Create a new medicine, update selling price and stock details, and keep batch, expiry, supplier, and prescription rules accurate."
          }
          action={<Badge variant="accent">Batch-controlled</Badge>}
        />
        <MedicineForm suppliers={suppliers} actionLabel="Save medicine entry" canManagePurchasePrice={canManagePurchasePrice} />
      </Card>

      <Card>
        <CardHeader
          title="Inventory overview"
          description="Medicines are grouped once, with every active batch shown inside the same row for cleaner stock review."
          action={<Badge variant="success">{inventoryGroups.length} medicines / {inventoryRows.length} active batches</Badge>}
        />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Medicine</TableHeaderCell>
              <TableHeaderCell>Batches</TableHeaderCell>
              <TableHeaderCell>Total stock</TableHeaderCell>
              <TableHeaderCell>Pricing</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {inventoryGroups.map((group) => (
              <TableRow key={group.medicine_id}>
                <TableCell>
                  <p className="font-semibold text-slate-950">{group.medicine_name}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{group.category}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="accent">{group.batches.length} batch{group.batches.length === 1 ? "" : "es"}</Badge>
                    {group.rx_required ? <Badge variant="warning">Rx</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-3">
                    {group.batches.map((batch) => (
                      <div key={batch.batch_id} className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                        <p className="font-semibold text-slate-900">Batch {batch.batch_number}</p>
                        <p className="mt-1 text-xs text-slate-500">{batch.supplier_name || "No supplier linked"}</p>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Expires {batch.expiry_date}</span>
                          <span>{formatQuantity(batch.stock_quantity)} in stock</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <p className="font-semibold text-slate-950">{formatQuantity(group.total_stock_quantity)}</p>
                  <p className="text-xs text-slate-500">Across {group.batches.length} active batch{group.batches.length === 1 ? "" : "es"}</p>
                </TableCell>
                <TableCell>
                  {canManagePurchasePrice ? <p>{formatPriceRange(group.batches.map((batch) => batch.purchase_price), currency)} cost</p> : null}
                  <p className="text-xs text-slate-500">{formatPriceRange(group.batches.map((batch) => batch.selling_price), currency)} MRP</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {group.low_stock_batches ? <Badge variant="danger">{group.low_stock_batches} low stock</Badge> : <Badge variant="success">Healthy</Badge>}
                    <Badge variant="accent">Batch-managed</Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-3">
                    <div className="space-y-3">
                      {group.batches.map((batch) => (
                        <details key={batch.batch_id} className="group rounded-2xl border border-slate-200 bg-white">
                          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700">
                            <PencilLine className="h-4 w-4" />
                            Edit batch {batch.batch_number}
                          </summary>
                          <div className="border-t border-slate-200 p-4">
                            <MedicineForm
                              suppliers={suppliers}
                              actionLabel="Update batch"
                              canManagePurchasePrice={canManagePurchasePrice}
                              initial={{
                                medicine_id: batch.medicine_id,
                                batch_id: batch.batch_id,
                                name: batch.medicine_name,
                                category: batch.category,
                                supplier_name: batch.supplier_name,
                                rx_required: batch.rx_required,
                                batch_number: batch.batch_number,
                                expiry_date: batch.expiry_date,
                                stock_quantity: batch.stock_quantity,
                                purchase_price: canManagePurchasePrice ? batch.purchase_price : undefined,
                                selling_price: batch.selling_price,
                                low_stock_threshold: batch.low_stock_threshold
                              }}
                            />
                          </div>
                        </details>
                      ))}
                    </div>

                    <form action={archiveMedicineAction}>
                      <input type="hidden" name="medicine_id" value={group.medicine_id} />
                      <Button type="submit" variant="secondary" className="w-full justify-start">
                        <Archive className="h-4 w-4" />
                        Archive medicine
                      </Button>
                    </form>
                    <p className="text-xs leading-5 text-slate-500">
                      Archiving hides the full medicine and all of its batches together. Batches stay preserved inside sales history.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Low stock policy" description="Default threshold and replenishment guidance for the store." action={<AlertTriangle className="h-5 w-5 text-amber-600" />} />
          <p className="text-sm leading-7 text-slate-600">
            Current default alert level is <span className="font-semibold text-slate-950">{settings?.default_low_stock_threshold ?? 10} units</span>. Staff can override thresholds per batch while receiving stock.
          </p>
        </Card>
        <Card>
          <CardHeader title="Inventory discipline" description="Operational guidance to keep data clean and compliant." action={<Boxes className="h-5 w-5 text-brand-700" />} />
          <ul className="space-y-3 text-sm leading-6 text-slate-600">
            <li>Use purchase receipts for supplier replenishment so stock movements remain traceable.</li>
            <li>Edit batches directly when correcting manual counts, damaged goods, or shelf reconciliation.</li>
            <li>Archive medicines instead of hard deleting to preserve historical sales and return integrity.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
