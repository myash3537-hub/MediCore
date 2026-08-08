import Link from "next/link";
import { Download, Receipt } from "lucide-react";

import { AdminSaleManager } from "@/components/forms/admin-sale-manager";
import { PosForm } from "@/components/forms/pos-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getBillingData } from "@/lib/data/pharmacy";
import { formatCurrency, formatPaymentLabel } from "@/lib/utils";

export default async function BillingPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    sale?: string;
    success?: string;
  };
}) {
  const data = await getBillingData();
  const saleId = searchParams?.sale?.trim();
  const currency = data.settings?.currency_code ?? "INR";

  return (
    <div className="space-y-6">
      {searchParams?.error ? (
        <Card className="bg-rose-50">
          <div className="text-sm font-semibold text-rose-900">{decodeURIComponent(searchParams.error)}</div>
        </Card>
      ) : null}

      {searchParams?.success ? (
        <Card className="bg-brand-50">
          <div className="text-sm font-semibold text-brand-900">{decodeURIComponent(searchParams.success)}</div>
        </Card>
      ) : null}

      {saleId ? (
        <Card className="bg-brand-50">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Sale completed</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-slate-950">Invoice ready for print or PDF export</h2>
            </div>
            <Link href={`/api/invoice/${saleId}`} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-semibold text-white">
              <Download className="h-4 w-4" />
              Download invoice PDF
            </Link>
          </div>
        </Card>
      ) : null}

      <PosForm stockRows={data.stockRows} settings={data.settings} />

      <Card className="overflow-hidden">
        <CardHeader title="All invoices" description="Complete POS transaction history from the first sale to the latest." action={<Badge variant="accent">{data.recentSales.length} invoices</Badge>} />
        <div className="scrollbar-thin max-h-[32rem] overflow-y-auto pr-2">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Date</TableHeaderCell>
                <TableHeaderCell>Customer</TableHeaderCell>
                <TableHeaderCell>Payment</TableHeaderCell>
                <TableHeaderCell>Total</TableHeaderCell>
                <TableHeaderCell>Due</TableHeaderCell>
                <TableHeaderCell>Invoice</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {data.recentSales.length ? (
                data.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>{sale.invoice_number}</TableCell>
                    <TableCell>{sale.sale_date.slice(0, 10)}</TableCell>
                    <TableCell>{sale.customer_name || "Walk-in customer"}</TableCell>
                    <TableCell>{formatPaymentLabel(sale, currency)}</TableCell>
                    <TableCell>{formatCurrency(sale.total_amount, currency)}</TableCell>
                    <TableCell>{formatCurrency(sale.due_amount ?? 0, currency)}</TableCell>
                    <TableCell>
                      <Link href={`/api/invoice/${sale.id}`} className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700">
                        <Receipt className="h-4 w-4" />
                        PDF
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-slate-500">
                    No sales have been recorded yet. Complete a sale to generate the first invoice and history row.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {data.profile.role === "admin" ? (
        <Card>
          <CardHeader
            title="Admin sale controls"
            description="Edit any saved sale, update invoice data, and delete incorrect transactions. Invoice PDFs always reflect the latest saved values."
            action={<Badge variant="warning">Admin only</Badge>}
          />
          <AdminSaleManager sales={data.editableSales} currency={currency} />
        </Card>
      ) : null}
    </div>
  );
}
