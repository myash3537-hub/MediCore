import { Receipt, Truck } from "lucide-react";

import { PurchaseForm } from "@/components/forms/purchase-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth";
import { getPurchaseData, getStoreSettings } from "@/lib/data/pharmacy";
import { formatCurrency } from "@/lib/utils";

export default async function PurchasesPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    purchase?: string;
  };
}) {
  await requireRole("admin");
  const [data, settings] = await Promise.all([getPurchaseData(), getStoreSettings()]);
  const currency = settings?.currency_code ?? "INR";

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <Card className="bg-rose-50">
          <div className="text-sm font-semibold text-rose-900">{decodeURIComponent(searchParams.error)}</div>
        </Card>
      ) : null}

      {searchParams?.purchase ? (
        <Card className="bg-brand-50">
          <div className="flex items-center gap-3">
            <Truck className="h-5 w-5 text-brand-700" />
            <p className="text-sm font-semibold text-brand-900">Purchase receipt recorded successfully. Inventory and stock levels have been updated.</p>
          </div>
        </Card>
      ) : null}

      <PurchaseForm medicines={data.medicines} suppliers={data.suppliers} defaultLowStockThreshold={settings?.default_low_stock_threshold ?? 10} />

      <Card>
        <CardHeader title="Recent purchase history" description="Track supplier receipts, invoice references, and procurement totals." action={<Badge variant="accent">{data.recentPurchases.length} recent receipts</Badge>} />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell>Supplier</TableHeaderCell>
              <TableHeaderCell>Total</TableHeaderCell>
              <TableHeaderCell>Receipt</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.recentPurchases.length ? (
              data.recentPurchases.map((purchase) => (
                <TableRow key={purchase.id}>
                  <TableCell>{purchase.invoice_number || "Manual receipt"}</TableCell>
                  <TableCell>{purchase.purchase_date.slice(0, 10)}</TableCell>
                  <TableCell>{purchase.suppliers?.name || "Supplier not linked"}</TableCell>
                  <TableCell>{formatCurrency(purchase.total_amount, currency)}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                      <Receipt className="h-4 w-4" />
                      Logged
                    </span>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-slate-500">
                  No purchase receipts have been recorded yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
