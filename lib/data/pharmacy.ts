import { format, parseISO, startOfDay, startOfMonth, subDays } from "date-fns";

import { requireAuthenticated, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuditLog, ChartDatum, InventorySnapshotRow, OnlinePaymentMethod, PaymentMethod, Profile, PurchaseSummary, SaleSummary, StoreSettings, Supplier } from "@/lib/types";
import { normalizeStoreName } from "@/lib/utils";

const PAGE_SIZE = 1000;

type RangeQuery = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>;
};

function toNumber(value: unknown) {
  return Number(value ?? 0);
}

async function fetchAllRows<T>(queryFactory: () => RangeQuery) {
  const rows: T[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    const page = ((data ?? []) as T[]) ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function buildDailySeries(rows: Array<{ sale_date: string; total_amount: number }>) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = subDays(startOfDay(new Date()), 6 - index);
    return {
      key: format(date, "yyyy-MM-dd"),
      label: format(date, "dd MMM"),
      value: 0
    };
  });

  rows.forEach((row) => {
    const key = format(parseISO(row.sale_date), "yyyy-MM-dd");
    const match = days.find((entry) => entry.key === key);

    if (match) {
      match.value += toNumber(row.total_amount);
    }
  });

  return days.map(({ label, value }) => ({ label, value }));
}

export async function getStoreSettings() {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase.from("store_settings").select("*").limit(1).maybeSingle();
  if (!data) {
    return null;
  }

  return {
    ...(data as StoreSettings),
    store_name: normalizeStoreName((data as StoreSettings).store_name)
  };
}

export async function getSuppliers() {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase.from("suppliers").select("*").order("name");
  return (data as Supplier[] | null) ?? [];
}

export async function getInventorySnapshot() {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const data = await fetchAllRows<InventorySnapshotRow>(() => supabase.from("inventory_snapshot").select("*").order("medicine_name"));
  return data.map((row) => ({
    ...row,
    stock_quantity: toNumber(row.stock_quantity),
    purchase_price: toNumber(row.purchase_price),
    selling_price: toNumber(row.selling_price),
    tablets_per_strip: Math.max(1, Math.round(toNumber(row.tablets_per_strip || 10))),
    low_stock_threshold: toNumber(row.low_stock_threshold)
  }));
}

export async function getMedicinesCatalog() {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("medicines")
    .select("id, name, category, rx_required, default_supplier_id")
    .eq("is_active", true)
    .order("name");

  return (data as Array<Record<string, unknown>> | null) ?? [];
}

export async function getNotifications(role: Profile["role"], limit = 6) {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .or(`target_role.is.null,target_role.eq.${role}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Array<Record<string, unknown>> | null) ?? [];
}

export async function getDashboardData() {
  const sessionContext = await requireAuthenticated();
  const profile = sessionContext.profile as Profile;
  const supabase = createAdminClient();
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const [settings, inventoryRows, salesRows, monthSalesRows, recentSalesRows, notifications, auditLogRows] = await Promise.all([
    getStoreSettings(),
    getInventorySnapshot(),
    supabase
      .from("sales")
      .select("id, sale_date, total_amount")
      .gte("sale_date", subDays(today, 6).toISOString())
      .order("sale_date"),
    supabase.from("sales").select("total_amount, sale_date").gte("sale_date", monthStart.toISOString()),
    supabase
      .from("sales")
      .select("id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, payment_method, cash_amount, online_amount, online_payment_method")
      .order("sale_date", { ascending: false })
      .limit(6),
    getNotifications(profile.role),
    profile.role === "admin"
      ? supabase
          .from("audit_logs")
          .select("id, entity_name, entity_id, action, details, created_at, profiles(full_name, email)")
          .order("created_at", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] })
  ]);

  const trendRows = ((salesRows.data as Array<Record<string, unknown>> | null) ?? []).map((row) => ({
    sale_date: String(row.sale_date),
    total_amount: toNumber(row.total_amount)
  }));

  const recentSales = (((recentSalesRows.data as SaleSummary[] | null) ?? []) as SaleSummary[]).map((sale) => ({
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discount_amount: toNumber(sale.discount_amount),
    tax_amount: toNumber(sale.tax_amount),
    total_amount: toNumber(sale.total_amount),
    payment_method: sale.payment_method as PaymentMethod,
    cash_amount: toNumber(sale.cash_amount),
    online_amount: toNumber(sale.online_amount),
    online_payment_method: (sale.online_payment_method as OnlinePaymentMethod | null | undefined) ?? null
  }));

  const lowStockItems = inventoryRows
    .filter((item) => item.stock_quantity <= item.low_stock_threshold)
    .sort((a, b) => a.stock_quantity - b.stock_quantity);
  const expiryAlertDate = new Date();
  expiryAlertDate.setDate(expiryAlertDate.getDate() + (settings?.expiry_alert_days ?? 45));
  const expiringItems = inventoryRows
    .filter((item) => {
      const expiryDate = parseISO(item.expiry_date);
      return expiryDate <= expiryAlertDate;
    })
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date));

  const todaySales = trendRows
    .filter((row) => format(parseISO(row.sale_date), "yyyy-MM-dd") === format(today, "yyyy-MM-dd"))
    .reduce((total, row) => total + row.total_amount, 0);

  const monthSales = (((monthSalesRows.data as Array<Record<string, unknown>> | null) ?? []) as Array<Record<string, unknown>>).reduce(
    (total, row) => total + toNumber(row.total_amount),
    0
  );

  const inventoryValue = inventoryRows.reduce((total, row) => total + row.stock_quantity * row.purchase_price, 0);
  const totalUnits = inventoryRows.reduce((total, row) => total + row.stock_quantity, 0);
  const stockLevels: ChartDatum[] = inventoryRows
    .slice()
    .sort((a, b) => a.stock_quantity - b.stock_quantity)
    .slice(0, 6)
    .map((item) => ({
      label: item.medicine_name,
      value: item.stock_quantity
    }));

  return {
    profile,
    settings,
    metrics: {
      todaySales,
      monthSales,
      inventoryValue,
      totalUnits,
      lowStockCount: lowStockItems.length,
      expiringCount: expiringItems.length
    },
    salesTrend: buildDailySeries(trendRows),
    stockLevels,
    lowStockItems,
    expiringItems,
    recentSales,
    notifications,
    auditLogs: (auditLogRows.data as AuditLog[] | null) ?? []
  };
}

export async function getBillingData() {
  const { profile } = await requireAuthenticated();
  const supabase = createAdminClient();
  const [settings, inventoryRows, recentSales, editableSalesRows] = await Promise.all([
    getStoreSettings(),
    getInventorySnapshot(),
    getRecentSales(),
    profile.role === "admin"
      ? fetchAllRows<Record<string, unknown>>(() =>
          supabase
            .from("sales")
            .select(
              "id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, payment_method, cash_amount, online_amount, online_payment_method, notes, sale_items(id, medicine_id, batch_id, quantity, unit_price, line_total, medicines(name), medicine_batches(batch_number))"
            )
            .order("sale_date", { ascending: false })
        )
      : Promise.resolve([])
  ]);

  return {
    profile,
    settings,
    stockRows: inventoryRows.filter((item) => item.stock_quantity > 0),
    recentSales,
    editableSales: editableSalesRows
  };
}

export async function getRecentSales(limit?: number) {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const selectColumns = "id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, payment_method, cash_amount, online_amount, online_payment_method";
  const data =
    typeof limit === "number"
      ? (((await supabase.from("sales").select(selectColumns).order("sale_date", { ascending: false }).limit(limit)).data as SaleSummary[] | null) ?? [])
      : await fetchAllRows<SaleSummary>(() => supabase.from("sales").select(selectColumns).order("sale_date", { ascending: false }));

  return data.map((sale) => ({
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discount_amount: toNumber(sale.discount_amount),
    tax_amount: toNumber(sale.tax_amount),
    total_amount: toNumber(sale.total_amount),
    cash_amount: toNumber(sale.cash_amount),
    online_amount: toNumber(sale.online_amount),
    online_payment_method: (sale.online_payment_method as OnlinePaymentMethod | null | undefined) ?? null
  }));
}

export async function getPurchaseData() {
  await requireRole("admin");
  const [suppliers, medicines, recentPurchases] = await Promise.all([
    getSuppliers(),
    getMedicinesCatalog(),
    getRecentPurchases()
  ]);

  return {
    suppliers,
    medicines,
    recentPurchases
  };
}

export async function getRecentPurchases(limit?: number) {
  await requireAuthenticated();
  const supabase = createAdminClient();
  const selectColumns = "id, invoice_number, purchase_date, subtotal, total_amount, supplier_id, suppliers(id, name)";
  const data =
    typeof limit === "number"
      ? (((await supabase.from("purchases").select(selectColumns).order("purchase_date", { ascending: false }).limit(limit)).data as PurchaseSummary[] | null) ?? [])
      : await fetchAllRows<PurchaseSummary>(() => supabase.from("purchases").select(selectColumns).order("purchase_date", { ascending: false }));

  return data.map((purchase) => ({
    ...purchase,
    subtotal: toNumber(purchase.subtotal),
    total_amount: toNumber(purchase.total_amount)
  }));
}

export async function getReturnsData() {
  const { profile } = await requireAuthenticated();
  const supabase = createAdminClient();
  const [settings, recentReturns, saleCandidates, editableReturns] = await Promise.all([
    getStoreSettings(),
    fetchAllRows<Record<string, unknown>>(() =>
      supabase
        .from("sales_returns")
        .select("id, refund_amount, reason, return_date, sale_id, sales(invoice_number, customer_name)")
        .order("return_date", { ascending: false })
    ),
    fetchAllRows<Record<string, unknown>>(() =>
      supabase
        .from("sales")
        .select("id, invoice_number, customer_name, total_amount, sale_date, sale_items(id, quantity, unit_price, line_total, batch_id, medicine_id, medicines(name), medicine_batches(batch_number, tablets_per_strip))")
        .order("sale_date", { ascending: false })
    ),
    profile.role === "admin"
      ? fetchAllRows<Record<string, unknown>>(() =>
          supabase
            .from("sales_returns")
            .select(
              "id, refund_amount, reason, return_date, sale_id, sales(invoice_number, customer_name), sale_return_items(id, sale_item_id, batch_id, quantity, refund_amount, sale_items(quantity, unit_price, medicines(name), medicine_batches(batch_number)))"
            )
            .order("return_date", { ascending: false })
        )
      : Promise.resolve([])
  ]);

  return {
    profile,
    settings,
    recentReturns,
    saleCandidates,
    editableReturns
  };
}

export async function getReportsData() {
  const [inventoryRows, recentSales, recentPurchases, settings] = await Promise.all([
    getInventorySnapshot(),
    getRecentSales(),
    getRecentPurchases(),
    getStoreSettings()
  ]);

  const salesByDay = buildDailySeries(
    recentSales.map((item) => ({
      sale_date: item.sale_date,
      total_amount: item.total_amount
    }))
  );

  const expiryAlertDate = new Date();
  expiryAlertDate.setDate(expiryAlertDate.getDate() + (settings?.expiry_alert_days ?? 45));
  const expiringItems = inventoryRows.filter((item) => {
    return parseISO(item.expiry_date) <= expiryAlertDate;
  });

  return {
    settings,
    inventoryRows,
    recentSales,
    recentPurchases,
    salesByDay,
    expiringItems
  };
}

export async function getUsersData() {
  await requireRole("admin");
  const supabase = createAdminClient();
  const [profiles, auditLogs] = await Promise.all([
    supabase.from("profiles").select("id, email, full_name, role, permissions, is_active, created_at, last_seen_at").order("created_at"),
    supabase
      .from("audit_logs")
      .select("id, entity_name, entity_id, action, details, created_at, profiles(full_name, email)")
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return {
    profiles: (profiles.data as Profile[] | null) ?? [],
    auditLogs: (auditLogs.data as AuditLog[] | null) ?? []
  };
}
