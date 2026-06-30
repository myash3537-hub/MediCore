import Link from "next/link";
import { AlertTriangle, Archive, Boxes, CircleAlert, CircleCheckBig, Info, PencilLine, Search, Sparkles } from "lucide-react";

import { archiveMedicineAction, deleteBatchAction } from "@/lib/actions/pharmacy";
import { MedicineForm } from "@/components/forms/medicine-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function filterInventoryGroups(groups: InventoryGroup[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return groups;
  }

  return groups.filter((group) => {
    const medicineMatch =
      group.medicine_name.toLowerCase().includes(normalizedQuery) || group.category.toLowerCase().includes(normalizedQuery);

    if (medicineMatch) {
      return true;
    }

    return group.batches.some((batch) => {
      const supplierName = batch.supplier_name?.toLowerCase() ?? "";
      return batch.batch_number.toLowerCase().includes(normalizedQuery) || supplierName.includes(normalizedQuery);
    });
  });
}

export default async function InventoryPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    info?: string;
    success?: string;
    query?: string;
  };
}) {
  const { profile } = await requireAuthenticated();
  const [inventoryRows, suppliers, settings] = await Promise.all([getInventorySnapshot(), getSuppliers(), getStoreSettings()]);
  const currency = settings?.currency_code ?? "INR";
  const canManagePurchasePrice = profile.role === "admin";
  const inventoryGroups = groupInventoryRows(inventoryRows);
  const searchQuery = searchParams?.query?.trim() ?? "";
  const filteredInventoryGroups = filterInventoryGroups(inventoryGroups, searchQuery);

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
          title="Search inventory fast"
          description="Jump straight to a medicine, batch number, category, or supplier without scanning the full stock board."
          action={<Badge variant="success">{filteredInventoryGroups.length} visible medicines</Badge>}
        />
        <form className="grid gap-4 lg:grid-cols-[1fr_auto_auto]" method="get">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="query"
              defaultValue={searchQuery}
              placeholder="Search medicine name, batch, category, supplier..."
              className="h-12 rounded-[22px] border-white/80 bg-white/[0.84] pl-11 shadow-[0_16px_32px_rgba(15,23,42,0.06)]"
            />
          </div>
          <Button type="submit" variant="success" className="h-12 rounded-[22px] px-6">
            <Sparkles className="h-4 w-4" />
            Search now
          </Button>
          <Link
            href="/inventory"
            className="inline-flex h-12 items-center justify-center rounded-[22px] border border-slate-200 bg-white/[0.82] px-6 text-sm font-semibold text-slate-700 shadow-[0_14px_30px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            Clear
          </Link>
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Inventory overview"
          description={
            searchQuery
              ? `Showing matches for "${searchQuery}". Medicines stay grouped once, with all active batches nested inside the same row.`
              : "Medicines are grouped once, with every active batch shown inside the same row for cleaner stock review."
          }
          action={<Badge variant="success">{filteredInventoryGroups.length} medicines / {inventoryRows.length} active batches</Badge>}
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
            {filteredInventoryGroups.map((group) => (
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
                          <span>{formatQuantity(batch.stock_quantity)} strips in stock</span>
                          <span>{batch.tablets_per_strip} tabs/strip</span>
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
                                tablets_per_strip: batch.tablets_per_strip,
                                low_stock_threshold: batch.low_stock_threshold
                              }}
                            />
                            {canManagePurchasePrice ? (
                              <form action={deleteBatchAction} className="mt-4 border-t border-slate-200 pt-4">
                                <input type="hidden" name="batch_id" value={batch.batch_id} />
                                <Button type="submit" variant="secondary" className="w-full justify-start border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">
                                  <Archive className="h-4 w-4" />
                                  Delete this batch
                                </Button>
                                <p className="mt-2 text-xs leading-5 text-slate-500">
                                  Delete only works for batches that are not linked to sales, purchases, or returns.
                                </p>
                              </form>
                            ) : null}
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
            {!filteredInventoryGroups.length ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center">
                  <p className="font-semibold text-slate-900">No medicines matched that search.</p>
                  <p className="mt-2 text-sm text-slate-500">Try a medicine name, supplier, category, or batch number.</p>
                </TableCell>
              </TableRow>
            ) : null}
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
