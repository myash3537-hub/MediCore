import Link from "next/link";
import { BellRing, ClipboardList, PackageSearch, ShieldCheck, TrendingUp } from "lucide-react";

import { BarChart } from "@/components/charts/bar-chart";
import { LineChart } from "@/components/charts/line-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/table";
import { getDashboardData } from "@/lib/data/pharmacy";
import { formatCurrency, formatNumber, formatPaymentLabel } from "@/lib/utils";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const currency = data.settings?.currency_code ?? "INR";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Today sales" value={formatCurrency(data.metrics.todaySales, currency)} helper="Live total captured today" trend="up" />
        <StatCard title="Month sales" value={formatCurrency(data.metrics.monthSales, currency)} helper="Rolling month-to-date revenue" trend="up" />
        {data.profile.role === "admin" ? (
          <StatCard title="Inventory value" value={formatCurrency(data.metrics.inventoryValue, currency)} helper="Based on current purchase cost" trend="neutral" />
        ) : (
          <StatCard title="Stock units" value={formatNumber(data.metrics.totalUnits)} helper="Total units across active batches" trend="neutral" />
        )}
        <StatCard title="Operational alerts" value={formatNumber(data.metrics.lowStockCount + data.metrics.expiringCount)} helper="Low stock and expiring batches" trend="down" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Sales trend" description="Seven-day revenue view for faster demand and staffing decisions." />
          <LineChart data={data.salesTrend} currency={currency} />
        </Card>
        <Card>
          <CardHeader title="Critical stock watch" description="Lowest available batch quantities across the current inventory." />
          <BarChart data={data.stockLevels} />
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Low stock items" description="Items already at or below their configured minimum threshold." action={<Link href="/inventory" className="text-sm font-semibold text-brand-700">Open inventory</Link>} />
          {data.lowStockItems.length ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Medicine</TableHeaderCell>
                  <TableHeaderCell>Batch</TableHeaderCell>
                  <TableHeaderCell>Available</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.lowStockItems.map((item) => (
                  <TableRow key={item.batch_id}>
                    <TableCell>
                      <p className="font-semibold text-slate-950">{item.medicine_name}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.category}</p>
                    </TableCell>
                    <TableCell>{item.batch_number}</TableCell>
                    <TableCell>{item.stock_quantity}</TableCell>
                    <TableCell>
                      <Badge variant="danger">Low stock</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={PackageSearch} title="Inventory is healthy" description="Nothing has crossed the low stock threshold right now." />
          )}
        </Card>

        <Card>
          <CardHeader title="Expiry alerts" description="Batches expiring within the configured alert window." action={<Link href="/reports" className="text-sm font-semibold text-brand-700">Expiry report</Link>} />
          {data.expiringItems.length ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Medicine</TableHeaderCell>
                  <TableHeaderCell>Expiry</TableHeaderCell>
                  <TableHeaderCell>Stock</TableHeaderCell>
                  <TableHeaderCell>Prescription</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {data.expiringItems.map((item) => (
                  <TableRow key={item.batch_id}>
                    <TableCell>
                      <p className="font-semibold text-slate-950">{item.medicine_name}</p>
                      <p className="text-xs uppercase tracking-[0.16em] text-slate-500">Batch {item.batch_number}</p>
                    </TableCell>
                    <TableCell>{item.expiry_date}</TableCell>
                    <TableCell>{item.stock_quantity}</TableCell>
                    <TableCell>{item.rx_required ? <Badge variant="warning">Rx</Badge> : <Badge variant="success">OTC</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <EmptyState icon={ShieldCheck} title="No urgent expiries" description="The active stock is currently outside the expiry alert threshold." />
          )}
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader title="Recent sales" description="Latest completed invoices across the store." action={<Link href="/billing" className="text-sm font-semibold text-brand-700">Open POS</Link>} />
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Customer</TableHeaderCell>
                <TableHeaderCell>Payment</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {data.recentSales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <p className="font-semibold text-slate-950">{sale.invoice_number}</p>
                    <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{sale.sale_date.slice(0, 10)}</p>
                  </TableCell>
                  <TableCell>{sale.customer_name || "Walk-in customer"}</TableCell>
                  <TableCell>{formatPaymentLabel(sale, currency)}</TableCell>
                  <TableCell>{formatCurrency(sale.total_amount, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Notifications" description="Operational reminders and system notices for your role." action={<BellRing className="h-5 w-5 text-brand-700" />} />
          <div className="space-y-3">
            {data.notifications.length ? (
              data.notifications.map((notification) => (
                <div key={String(notification.id)} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={String(notification.severity) === "warning" ? "warning" : String(notification.severity) === "critical" ? "danger" : "accent"}>
                      {String(notification.severity)}
                    </Badge>
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{String(notification.created_at).slice(0, 10)}</p>
                  </div>
                  <p className="mt-3 font-semibold text-slate-950">{String(notification.title)}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{String(notification.body)}</p>
                </div>
              ))
            ) : (
              <EmptyState icon={ClipboardList} title="No unread notifications" description="System notices and operational reminders will appear here." />
            )}
          </div>
        </Card>
      </section>

      {data.profile.role === "admin" ? (
        <Card className="scroll-mt-24" id="activity">
          <CardHeader title="Recent activity log" description="Admin view of operational changes across the system." action={<TrendingUp className="h-5 w-5 text-brand-700" />} />
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Entity</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>User</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {data.auditLogs.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{entry.entity_name}</TableCell>
                  <TableCell>{entry.action}</TableCell>
                  <TableCell>{entry.profiles?.full_name || entry.profiles?.email || "System"}</TableCell>
                  <TableCell>{entry.created_at.slice(0, 16).replace("T", " ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : null}
    </div>
  );
}
