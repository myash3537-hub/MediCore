import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE = 1000;

type RangeQuery = {
  range: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>;
};

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    return "";
  }

  const headers = Object.keys(rows[0]);
  const escapeValue = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];

  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeValue(row[header])).join(","));
  });

  return lines.join("\n");
}

async function fetchAllRows(queryFactory: () => RangeQuery) {
  const rows: Array<Record<string, unknown>> = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    const page = ((data ?? []) as Array<Record<string, unknown>>) ?? [];
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

export async function GET(_request: Request, { params }: { params: { resource: string } }) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
  const role = String((profile as { role?: string } | null)?.role ?? "pharmacist");
  const resource = params.resource;
  let rows: Array<Record<string, unknown>> = [];

  if (resource === "sales") {
    rows = await fetchAllRows(() =>
      admin
        .from("sales")
        .select("invoice_number, sale_date, customer_name, payment_method, cash_amount, online_amount, online_payment_method, subtotal, discount_amount, tax_amount, total_amount")
        .order("sale_date", { ascending: false })
    );
  } else if (resource === "inventory") {
    const inventoryRows = await fetchAllRows(() =>
      admin
        .from("inventory_snapshot")
        .select("medicine_name, category, batch_number, expiry_date, stock_quantity, purchase_price, selling_price, tablets_per_strip, supplier_name, rx_required")
        .order("medicine_name")
    );
    rows = inventoryRows.map((row) =>
      role === "admin"
        ? row
        : {
            medicine_name: row.medicine_name,
            category: row.category,
            batch_number: row.batch_number,
            expiry_date: row.expiry_date,
            stock_quantity: row.stock_quantity,
            selling_price: row.selling_price,
            tablets_per_strip: row.tablets_per_strip,
            supplier_name: row.supplier_name,
            rx_required: row.rx_required
          }
    );
  } else if (resource === "expiry") {
    rows = await fetchAllRows(() =>
      admin
        .from("expiry_alerts")
        .select("medicine_name, category, batch_number, expiry_date, stock_quantity, tablets_per_strip, supplier_name")
        .order("expiry_date")
    );
  } else if (resource === "purchases") {
    if (role !== "admin") {
      return NextResponse.json({ error: "Purchase exports are available to admins only." }, { status: 403 });
    }

    const purchaseRows = await fetchAllRows(() =>
      admin
        .from("purchases")
        .select("invoice_number, purchase_date, subtotal, total_amount, suppliers(name)")
        .order("purchase_date", { ascending: false })
    );
    rows = (purchaseRows.map((row) => ({
      invoice_number: row.invoice_number,
      purchase_date: row.purchase_date,
      subtotal: row.subtotal,
      total_amount: row.total_amount,
      supplier_name: (row.suppliers as { name?: string } | null)?.name ?? ""
    })) as Array<Record<string, unknown>>) ?? [];
  } else {
    return NextResponse.json({ error: "Unsupported export resource" }, { status: 404 });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${resource}-report.csv"`
    }
  });
}
