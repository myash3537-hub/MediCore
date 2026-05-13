import { RotateCcw } from "lucide-react";

import { AdminReturnManager } from "@/components/forms/admin-return-manager";
import { ReturnForm } from "@/components/forms/return-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getReturnsData } from "@/lib/data/pharmacy";
import { formatCurrency } from "@/lib/utils";

export default async function ReturnsPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
    return?: string;
    success?: string;
  };
}) {
  const data = await getReturnsData();
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

      {searchParams?.return ? (
        <Card className="bg-brand-50">
          <div className="flex items-center gap-3 text-sm font-semibold text-brand-900">
            <RotateCcw className="h-5 w-5 text-brand-700" />
            Return processed and stock restored successfully.
          </div>
        </Card>
      ) : null}

      <ReturnForm sales={data.saleCandidates} />

      <Card>
        <CardHeader title="Recent sales returns" description="Track refunded invoices and stock restoration history." action={<Badge variant="warning">{data.recentReturns.length} recent returns</Badge>} />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Invoice</TableHeaderCell>
              <TableHeaderCell>Customer</TableHeaderCell>
              <TableHeaderCell>Return date</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>Refund</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {data.recentReturns.map((entry) => (
              <TableRow key={String(entry.id)}>
                <TableCell>{String((entry.sales as { invoice_number?: string } | null)?.invoice_number ?? "N/A")}</TableCell>
                <TableCell>{String((entry.sales as { customer_name?: string } | null)?.customer_name ?? "Walk-in customer")}</TableCell>
                <TableCell>{String(entry.return_date).slice(0, 10)}</TableCell>
                <TableCell>{String(entry.reason ?? "No reason captured")}</TableCell>
                <TableCell>{formatCurrency(Number(entry.refund_amount ?? 0), currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {data.profile.role === "admin" ? (
        <Card>
          <CardHeader
            title="Admin return controls"
            description="Edit refund quantities, refund values, and reasons, or delete a mistaken return while keeping stock in sync."
            action={<Badge variant="warning">Admin only</Badge>}
          />
          <AdminReturnManager returns={data.editableReturns} currency={currency} />
        </Card>
      ) : null}
    </div>
  );
}
