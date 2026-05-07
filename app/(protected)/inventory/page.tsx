import { AlertTriangle, Archive, Boxes, CircleAlert, CircleCheckBig, Info, PencilLine } from "lucide-react";

import { archiveMedicineAction } from "@/lib/actions/pharmacy";
import { MedicineForm } from "@/components/forms/medicine-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { requireAuthenticated } from "@/lib/auth";
import { getInventorySnapshot, getStoreSettings, getSuppliers } from "@/lib/data/pharmacy";
import { formatCurrency } from "@/lib/utils";

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
        <CardHeader title="Inventory overview" description="Live stock by batch with expiry and low stock visibility for faster replenishment." action={<Badge variant="success">{inventoryRows.length} active batches</Badge>} />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Medicine</TableHeaderCell>
              <TableHeaderCell>Batch</TableHeaderCell>
              <TableHeaderCell>Expiry</TableHeaderCell>
              <TableHeaderCell>Stock</TableHeaderCell>
              <TableHeaderCell>Pricing</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {inventoryRows.map((item) => (
              <TableRow key={item.batch_id}>
                <TableCell>
                  <p className="font-semibold text-slate-950">{item.medicine_name}</p>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.category}</p>
                </TableCell>
                <TableCell>
                  <p>{item.batch_number}</p>
                  <p className="text-xs text-slate-500">{item.supplier_name || "No supplier linked"}</p>
                </TableCell>
                <TableCell>{item.expiry_date}</TableCell>
                <TableCell>{item.stock_quantity}</TableCell>
                <TableCell>
                  {canManagePurchasePrice ? <p>{formatCurrency(item.purchase_price, currency)} cost</p> : null}
                  <p className="text-xs text-slate-500">{formatCurrency(item.selling_price, currency)} MRP</p>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {item.is_low_stock ? <Badge variant="danger">Low stock</Badge> : <Badge variant="success">Healthy</Badge>}
                    {item.rx_required ? <Badge variant="warning">Rx</Badge> : null}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-3">
                    <details className="group rounded-2xl border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-brand-700">
                        <PencilLine className="h-4 w-4" />
                        Edit
                      </summary>
                      <div className="border-t border-slate-200 p-4">
                        <MedicineForm
                          suppliers={suppliers}
                          actionLabel="Update batch"
                          canManagePurchasePrice={canManagePurchasePrice}
                          initial={{
                            medicine_id: item.medicine_id,
                            batch_id: item.batch_id,
                            name: item.medicine_name,
                            category: item.category,
                            supplier_name: item.supplier_name,
                            rx_required: item.rx_required,
                            batch_number: item.batch_number,
                            expiry_date: item.expiry_date,
                            stock_quantity: item.stock_quantity,
                            purchase_price: canManagePurchasePrice ? item.purchase_price : undefined,
                            selling_price: item.selling_price,
                            low_stock_threshold: item.low_stock_threshold
                          }}
                        />
                      </div>
                    </details>

                    <form action={archiveMedicineAction}>
                      <input type="hidden" name="medicine_id" value={item.medicine_id} />
                      <Button type="submit" variant="secondary" className="w-full justify-start">
                        <Archive className="h-4 w-4" />
                        Archive medicine
                      </Button>
                    </form>
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
