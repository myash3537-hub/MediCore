import Link from "next/link";
import { Download, FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { requireAuthenticated } from "@/lib/auth";
import { getReportsData } from "@/lib/data/pharmacy";
import { formatCurrency, formatNumber, formatPaymentLabel, formatQuantity } from "@/lib/utils";

export default async function ReportsPage() {
  const { profile } = await requireAuthenticated();
  const data = await getReportsData();
  const currency = data.settings?.currency_code ?? "INR";
  const isAdmin = profile.role === "admin";
  const weeklySales = data.recentSales.slice(0, 7).reduce((total, row) => total + row.total_amount, 0);
  const monthlySales = data.recentSales.reduce((total, row) => total + row.total_amount, 0);
  const purchaseSpend = data.recentPurchases.reduce((total, row) => total + row.total_amount, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Daily report</p>
          <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{formatCurrency(data.recentSales[0]?.total_amount ?? 0, currency)}</p>
          <p className="mt-2 text-sm text-slate-600">Latest invoice value captured today or most recently.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Weekly sales</p>
          <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{formatCurrency(weeklySales, currency)}</p>
          <p className="mt-2 text-sm text-slate-600">Last seven recorded sales entries.</p>
        </Card>
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Monthly sales</p>
          <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{formatCurrency(monthlySales, currency)}</p>
          <p className="mt-2 text-sm text-slate-600">Rolling thirty-one invoice total.</p>
        </Card>
        {isAdmin ? (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Purchase spend</p>
            <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{formatCurrency(purchaseSpend, currency)}</p>
            <p className="mt-2 text-sm text-slate-600">Recent procurement outflow across supplier receipts.</p>
          </Card>
        ) : (
          <Card>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Expiring batches</p>
            <p className="mt-3 font-display text-3xl font-semibold text-slate-950">{formatNumber(data.expiringItems.length)}</p>
            <p className="mt-2 text-sm text-slate-600">Batches that need disposal planning or discounting soon.</p>
          </Card>
        )}
      </section>

      <Card>
        <CardHeader
          title="Export center"
          description="Download operational reports as CSV or generate invoice PDFs for audit and accounting workflows."
          action={<Badge variant="accent">CSV + PDF</Badge>}
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/api/export/sales", label: "Sales CSV" },
            { href: "/api/export/inventory", label: "Inventory CSV" },
            { href: "/api/export/expiry", label: "Expiry CSV" },
            ...(isAdmin ? [{ href: "/api/export/purchases", label: "Purchases CSV" }] : [])
          ].map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800 transition hover:border-brand-300 hover:bg-brand-50">
              <Download className="h-4 w-4 text-brand-700" />
              {item.label}
            </Link>
          ))}
        </div>
      </Card>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Inventory report" description="Snapshot of current active stock by batch." action={<FileSpreadsheet className="h-5 w-5 text-brand-700" />} />
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Medicine</TableHeaderCell>
                <TableHeaderCell>Batch</TableHeaderCell>
                <TableHeaderCell>Stock</TableHeaderCell>
                <TableHeaderCell>MRP</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {data.inventoryRows.slice(0, 10).map((row) => (
                <TableRow key={row.batch_id}>
                  <TableCell>{row.medicine_name}</TableCell>
                  <TableCell>{row.batch_number}</TableCell>
                  <TableCell>{formatQuantity(row.stock_quantity)}</TableCell>
                  <TableCell>{formatCurrency(row.selling_price, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader title="Expiry report" description="Batches needing disposal planning, discounting, or supplier escalation." action={<Badge variant="warning">{data.expiringItems.length} flagged</Badge>} />
          <div className="scrollbar-thin max-h-[28rem] overflow-y-auto pr-2">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Medicine</TableHeaderCell>
                  <TableHeaderCell>Expiry</TableHeaderCell>
                  <TableHeaderCell>Stock</TableHeaderCell>
                  <TableHeaderCell>Category</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.expiringItems.map((row) => (
                  <TableRow key={row.batch_id}>
                    <TableCell>{row.medicine_name}</TableCell>
                    <TableCell>{row.expiry_date}</TableCell>
                    <TableCell>{formatQuantity(row.stock_quantity)}</TableCell>
                    <TableCell>{row.category}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader title="Sales report" description="Latest billing transactions available for operational or accounting review." />
          <div className="scrollbar-thin max-h-[28rem] overflow-y-auto pr-2">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Invoice</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Payment</TableHeaderCell>
                  <TableHeaderCell>Total</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.invoice_number}</TableCell>
                    <TableCell>{sale.sale_date.slice(0, 10)}</TableCell>
                    <TableCell>{formatPaymentLabel(sale, currency)}</TableCell>
                    <TableCell>{formatCurrency(sale.total_amount, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>

        {isAdmin ? (
          <Card>
            <CardHeader title="Purchase report" description="Latest supplier purchases available for reconciliation." />
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Invoice</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                  <TableHeaderCell>Supplier</TableHeaderCell>
                  <TableHeaderCell>Total</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.recentPurchases.slice(0, 10).map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>{purchase.invoice_number || "Manual receipt"}</TableCell>
                    <TableCell>{purchase.purchase_date.slice(0, 10)}</TableCell>
                    <TableCell>{purchase.suppliers?.name || "Supplier not linked"}</TableCell>
                    <TableCell>{formatCurrency(purchase.total_amount, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
