import { format, parseISO, startOfDay, startOfMonth, subDays } from "date-fns";

import { requireAuthenticated, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChartDatum, InventorySnapshotRow, OnlinePaymentMethod, PaymentMethod, Profile, PurchaseSummary, SaleSummary, StoreSettings, Supplier } from "@/lib/types";
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
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase.from("store_settings").select("*").eq("branch_id", branch.id).limit(1).maybeSingle();
  if (!data) {
    return null;
  }

  return {
    ...(data as StoreSettings),
    store_name: normalizeStoreName((data as StoreSettings).store_name)
  };
}

export async function getSuppliers() {
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase.from("suppliers").select("*").eq("branch_id", branch.id).order("name");
  return (data as Supplier[] | null) ?? [];
}

export async function getInventorySnapshot() {
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const data = await fetchAllRows<InventorySnapshotRow>(() => supabase.from("inventory_snapshot").select("*").eq("branch_id", branch.id).order("medicine_name"));
  return data.map((row) => ({
    ...row,
    stock_quantity: toNumber(row.stock_quantity),
    purchase_price: toNumber(row.purchase_price),
    selling_price: toNumber(row.selling_price),
    tablets_per_strip: row.category === "Tablet" ? Math.max(1, Math.round(toNumber(row.tablets_per_strip || 10))) : 1,
    low_stock_threshold: toNumber(row.low_stock_threshold),
    low_stock_alert_enabled: row.low_stock_alert_enabled ?? true
  }));
}

export async function getMedicinesCatalog() {
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("medicines")
    .select("id, name, generic_name, category, rx_required, default_supplier_id")
    .eq("branch_id", branch.id)
    .eq("is_active", true)
    .order("name");

  return (data as Array<Record<string, unknown>> | null) ?? [];
}

export async function getNotifications(role: Profile["role"], limit = 6) {
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .or(`branch_id.is.null,branch_id.eq.${branch.id}`)
    .or(`target_role.is.null,target_role.eq.${role}`)
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data as Array<Record<string, unknown>> | null) ?? [];
}

export async function getDashboardData() {
  const sessionContext = await requireAuthenticated();
  const profile = sessionContext.profile as Profile;
  const branch = sessionContext.branch;
  const supabase = createAdminClient();
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(new Date());

  const [settings, inventoryRows, salesRows, monthSalesRows, recentSalesRows, notifications] = await Promise.all([
    getStoreSettings(),
    getInventorySnapshot(),
    supabase
      .from("sales")
      .select("id, sale_date, total_amount")
      .eq("branch_id", branch.id)
      .gte("sale_date", subDays(today, 6).toISOString())
      .order("sale_date"),
    supabase.from("sales").select("total_amount, sale_date").eq("branch_id", branch.id).gte("sale_date", monthStart.toISOString()),
    supabase
      .from("sales")
      .select("id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, due_amount, payment_method, cash_amount, online_amount, online_payment_method")
      .eq("branch_id", branch.id)
      .order("sale_date", { ascending: false })
      .limit(6),
    getNotifications(profile.role)
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
    due_amount: toNumber(sale.due_amount),
    payment_method: sale.payment_method as PaymentMethod,
    cash_amount: toNumber(sale.cash_amount),
    online_amount: toNumber(sale.online_amount),
    online_payment_method: (sale.online_payment_method as OnlinePaymentMethod | null | undefined) ?? null
  }));

  const lowStockItems = Array.from(
    inventoryRows
      .reduce((groups, row) => {
        const existing = groups.get(row.medicine_id);

        if (existing) {
          existing.stock_quantity += row.stock_quantity;
          existing.low_stock_threshold = Math.max(existing.low_stock_threshold, row.low_stock_threshold);
          existing.batch_number = `${Number(existing.batch_number.split(" ")[0]) + 1} batches`;
          return groups;
        }

        groups.set(row.medicine_id, {
          ...row,
          batch_number: "1 batch"
        });
        return groups;
      }, new Map<string, InventorySnapshotRow>())
      .values()
  )
    .filter((item) => item.low_stock_alert_enabled && item.stock_quantity <= item.low_stock_threshold)
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
  const stockLevels: ChartDatum[] = lowStockItems
    .slice()
    .sort((a, b) => a.stock_quantity - b.stock_quantity)
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
    auditLogs: []
  };
}

export async function getBillingData() {
  const { profile, branch } = await requireAuthenticated();
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
              "id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, due_amount, payment_method, cash_amount, online_amount, online_payment_method, notes, sale_items(id, medicine_id, batch_id, quantity, unit_price, line_total, medicines(name), medicine_batches(batch_number))"
            )
            .eq("branch_id", branch.id)
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
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const selectColumns = "id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, due_amount, payment_method, cash_amount, online_amount, online_payment_method";
  const data =
    typeof limit === "number"
      ? (((await supabase.from("sales").select(selectColumns).eq("branch_id", branch.id).order("sale_date", { ascending: false }).limit(limit)).data as SaleSummary[] | null) ?? [])
      : await fetchAllRows<SaleSummary>(() => supabase.from("sales").select(selectColumns).eq("branch_id", branch.id).order("sale_date", { ascending: false }));

  return data.map((sale) => ({
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discount_amount: toNumber(sale.discount_amount),
    tax_amount: toNumber(sale.tax_amount),
    total_amount: toNumber(sale.total_amount),
    due_amount: toNumber(sale.due_amount),
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
  const { branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const selectColumns = "id, invoice_number, purchase_date, subtotal, total_amount, supplier_id, suppliers(id, name)";
  const data =
    typeof limit === "number"
      ? (((await supabase.from("purchases").select(selectColumns).eq("branch_id", branch.id).order("purchase_date", { ascending: false }).limit(limit)).data as PurchaseSummary[] | null) ?? [])
      : await fetchAllRows<PurchaseSummary>(() => supabase.from("purchases").select(selectColumns).eq("branch_id", branch.id).order("purchase_date", { ascending: false }));

  return data.map((purchase) => ({
    ...purchase,
    subtotal: toNumber(purchase.subtotal),
    total_amount: toNumber(purchase.total_amount)
  }));
}

export async function getReturnsData() {
  const { profile, branch } = await requireAuthenticated();
  const supabase = createAdminClient();
  const [settings, recentReturns, saleCandidates, editableReturns] = await Promise.all([
    getStoreSettings(),
    fetchAllRows<Record<string, unknown>>(() =>
      supabase
        .from("sales_returns")
        .select("id, refund_amount, reason, return_date, sale_id, sales(invoice_number, customer_name)")
        .eq("branch_id", branch.id)
        .order("return_date", { ascending: false })
    ),
    fetchAllRows<Record<string, unknown>>(() =>
      supabase
        .from("sales")
        .select("id, invoice_number, customer_name, total_amount, sale_date, sale_items(id, quantity, unit_price, line_total, batch_id, medicine_id, medicines(name), medicine_batches(batch_number, tablets_per_strip))")
        .eq("branch_id", branch.id)
        .order("sale_date", { ascending: false })
    ),
    profile.role === "admin"
      ? fetchAllRows<Record<string, unknown>>(() =>
          supabase
            .from("sales_returns")
            .select(
              "id, refund_amount, reason, return_date, sale_id, sales(invoice_number, customer_name), sale_return_items(id, sale_item_id, batch_id, quantity, refund_amount, sale_items(quantity, unit_price, medicines(name), medicine_batches(batch_number)))"
            )
            .eq("branch_id", branch.id)
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
  const profiles = await supabase.from("profiles").select("id, email, full_name, role, permissions, is_active, created_at, last_seen_at").order("created_at");

  return {
    profiles: (profiles.data as Profile[] | null) ?? [],
    auditLogs: []
  };
}
