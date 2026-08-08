import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { buildInvoicePdf } from "@/lib/pdf/invoice";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { BRAND_NAME, formatPaymentLabel, normalizeStoreName } from "@/lib/utils";

export async function GET(_request: Request, { params }: { params: { saleId: string } }) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const branchId = cookies().get("srs_branch_id")?.value ?? "";
  const [{ data: sale }, { data: items }, { data: settings }] = await Promise.all([
    admin
      .from("sales")
      .select("id, invoice_number, sale_date, customer_name, subtotal, discount_amount, tax_amount, total_amount, due_amount, payment_method, cash_amount, online_amount, online_payment_method, notes")
      .eq("id", params.saleId)
      .eq("branch_id", branchId)
      .maybeSingle(),
    admin
      .from("sale_items")
      .select("quantity, unit_price, line_total, medicines(name), medicine_batches(batch_number)")
      .eq("sale_id", params.saleId),
    admin.from("store_settings").select("*").eq("branch_id", branchId).limit(1).maybeSingle()
  ]);

  if (!sale) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const currencyCode = String((settings as { currency_code?: string } | null)?.currency_code ?? "INR");
  const pdfBytes = await buildInvoicePdf({
    storeName: normalizeStoreName((settings as { store_name?: string | null } | null)?.store_name ?? BRAND_NAME),
    storeAddress: (settings as { store_address?: string | null } | null)?.store_address ?? null,
    storeContact: (settings as { store_contact?: string | null } | null)?.store_contact ?? null,
    invoiceNumber: String((sale as { invoice_number?: string }).invoice_number ?? "Invoice"),
    saleDate: String((sale as { sale_date?: string }).sale_date ?? "").slice(0, 16).replace("T", " "),
    customerName: (sale as { customer_name?: string | null }).customer_name ?? null,
    paymentMethod: formatPaymentLabel(
      {
        payment_method: String((sale as { payment_method?: string }).payment_method ?? "Cash") as "Cash" | "UPI" | "Card" | "Split",
        cash_amount: Number((sale as { cash_amount?: number }).cash_amount ?? 0),
        online_amount: Number((sale as { online_amount?: number }).online_amount ?? 0),
        online_payment_method: ((sale as { online_payment_method?: "UPI" | "Card" | null }).online_payment_method ?? null) as "UPI" | "Card" | null
      },
      currencyCode
    ),
    subtotal: Number((sale as { subtotal?: number }).subtotal ?? 0),
    discountAmount: Number((sale as { discount_amount?: number }).discount_amount ?? 0),
    taxAmount: Number((sale as { tax_amount?: number }).tax_amount ?? 0),
    totalAmount: Number((sale as { total_amount?: number }).total_amount ?? 0),
    dueAmount: Number((sale as { due_amount?: number }).due_amount ?? 0),
    notes: (sale as { notes?: string | null }).notes ?? null,
    currencyCode,
    items: ((items as Array<Record<string, unknown>> | null) ?? []).map((item) => ({
      medicine_name: String((item.medicines as { name?: string } | null)?.name ?? "Medicine"),
      batch_number: String((item.medicine_batches as { batch_number?: string } | null)?.batch_number ?? "N/A"),
      quantity: Number(item.quantity ?? 0),
      unit_price: Number(item.unit_price ?? 0),
      line_total: Number(item.line_total ?? 0)
    }))
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${String((sale as { invoice_number?: string }).invoice_number ?? "invoice")}.pdf"`
    }
  });
}
