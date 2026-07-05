"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { defaultPermissions } from "@/lib/constants";
import { requireAuthenticated, requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PaymentMethod, Profile } from "@/lib/types";

function asString(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function asNumber(value: FormDataEntryValue | null) {
  return Number(value ?? 0);
}

function toMoney(value: number) {
  return Number(value.toFixed(2));
}

function asBoolean(value: FormDataEntryValue | null) {
  return String(value ?? "") === "on" || String(value ?? "") === "true";
}

function parseJsonField<T>(value: FormDataEntryValue | null, fallback: T): T {
  try {
    const raw = String(value ?? "").trim();
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function redirectWithMessage(path: string, key: "error" | "info" | "success", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

type EditableSaleItemPayload = {
  id: string;
  medicine_id: string;
  batch_id: string;
  quantity: number;
  unit_price: number;
};

type EditableReturnItemPayload = {
  id: string;
  sale_item_id: string;
  batch_id: string;
  quantity: number;
  refund_amount: number;
};

function toQuantity(value: number) {
  return Number(value.toFixed(4));
}

function revalidateOperationsPages() {
  revalidatePath("/billing");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/returns");
}

function resolvePaymentBreakdown({
  paymentMethod,
  totalAmount,
  cashAmount,
  onlineAmount,
  onlinePaymentMethod
}: {
  paymentMethod: PaymentMethod;
  totalAmount: number;
  cashAmount: number;
  onlineAmount: number;
  onlinePaymentMethod: string | null;
}) {
  if (paymentMethod === "Cash") {
    return {
      cashAmount: totalAmount,
      onlineAmount: 0,
      onlinePaymentMethod: null
    };
  }

  if (paymentMethod === "UPI" || paymentMethod === "Card") {
    return {
      cashAmount: 0,
      onlineAmount: totalAmount,
      onlinePaymentMethod: paymentMethod
    };
  }

  const splitDifference = Math.abs(toMoney(totalAmount - (cashAmount + onlineAmount)));

  if (!onlinePaymentMethod || !["UPI", "Card"].includes(onlinePaymentMethod)) {
    throw new Error("Choose whether the online portion is paid by UPI or Card.");
  }

  if (totalAmount > 0 && (cashAmount <= 0 || onlineAmount <= 0)) {
    throw new Error("Split payments must include both a cash amount and an online amount.");
  }

  if (splitDifference > 0.01) {
    throw new Error("Cash and online amounts must match the final bill total.");
  }

  return {
    cashAmount,
    onlineAmount,
    onlinePaymentMethod
  };
}

async function resolveSupplierId({
  supplierId,
  supplierName
}: {
  supplierId: string;
  supplierName: string;
}) {
  if (supplierId) {
    return supplierId;
  }

  if (!supplierName) {
    return null;
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("suppliers")
    .upsert(
      {
        name: supplierName
      },
      {
        onConflict: "name"
      }
    )
    .select("id")
    .single();

  return (data as { id: string } | null)?.id ?? null;
}

async function recordAuditForUser(
  _userId: string | null,
  _entityName: string,
  _entityId: string,
  _action: string,
  _details: Record<string, unknown>
) {
  return;
}

export async function upsertMedicineAction(formData: FormData) {
  const { profile } = await requireAuthenticated();
  const supabase = createAdminClient();
  const canManagePurchasePrice = profile?.role === "admin";

  const medicineId = asString(formData.get("medicine_id"));
  const batchId = asString(formData.get("batch_id"));
  const medicineName = asString(formData.get("name"));
  const batchNumber = asString(formData.get("batch_number"));
  const expiryDate = asString(formData.get("expiry_date"));

  if ((batchNumber && !expiryDate) || (!batchNumber && expiryDate)) {
    redirectWithMessage("/inventory", "error", "Batch number and expiry date must be filled together.");
  }

  const supplierId = await resolveSupplierId({
    supplierId: asString(formData.get("supplier_id")),
    supplierName: asString(formData.get("supplier_name"))
  });

  const medicinePayload = {
    name: medicineName,
    category: asString(formData.get("category")),
    default_supplier_id: supplierId,
    rx_required: asBoolean(formData.get("rx_required")),
    low_stock_alert_enabled: asBoolean(formData.get("low_stock_alert_enabled")),
    description: asString(formData.get("description")) || null,
    sku: asString(formData.get("sku")) || null,
    is_active: true
  };

  let resolvedMedicineId = medicineId;
  if (!resolvedMedicineId && medicineName) {
    const { data: existingMedicine } = await supabase.from("medicines").select("id").ilike("name", medicineName).maybeSingle();
    resolvedMedicineId = (existingMedicine as { id: string } | null)?.id ?? "";
  }

  const medicineResponse = resolvedMedicineId
    ? await supabase.from("medicines").update(medicinePayload).eq("id", resolvedMedicineId).select("id").single()
    : await supabase
        .from("medicines")
        .insert({
          ...medicinePayload,
          created_by: profile?.id ?? null
        })
        .select("id")
        .single();

  if (medicineResponse.error) {
    redirectWithMessage("/inventory", "error", medicineResponse.error.message);
  }

  const savedMedicineId = (medicineResponse.data as { id: string } | null)?.id ?? resolvedMedicineId;

  if (!savedMedicineId) {
    redirectWithMessage("/inventory", "error", "Medicine could not be saved. Please try again.");
  }

  if (savedMedicineId && batchNumber && expiryDate) {
    const stockQuantity = asNumber(formData.get("stock_quantity"));
    const submittedPurchasePrice = asNumber(formData.get("purchase_price"));
    const sellingPrice = asNumber(formData.get("selling_price"));
    const medicineCategory = asString(formData.get("category"));
    const tabletsPerStrip = medicineCategory === "Tablet" ? Math.max(1, Math.round(asNumber(formData.get("tablets_per_strip")) || 10)) : 1;
    const lowStockThreshold = asNumber(formData.get("low_stock_threshold")) || 10;
    let existingBatchRecord: { id: string; stock_quantity: number; purchase_price: number } | null = null;

    if (batchId) {
      const { data: existingBatch } = await supabase
        .from("medicine_batches")
        .select("id, stock_quantity, purchase_price")
        .eq("id", batchId)
        .maybeSingle();

      existingBatchRecord = (existingBatch as { id: string; stock_quantity: number; purchase_price: number } | null) ?? null;
    } else {
      const { data: existingBatch } = await supabase
        .from("medicine_batches")
        .select("id, stock_quantity, purchase_price")
        .eq("medicine_id", savedMedicineId)
        .eq("batch_number", batchNumber)
        .maybeSingle();

      existingBatchRecord = (existingBatch as { id: string; stock_quantity: number; purchase_price: number } | null) ?? null;
    }

    if (!canManagePurchasePrice && !existingBatchRecord) {
      redirectWithMessage(
        "/inventory",
        "error",
        "Only admins can set purchase price for a new stock batch. Ask an admin to receive this stock."
      );
    }

    const effectivePurchasePrice = canManagePurchasePrice ? submittedPurchasePrice : Number(existingBatchRecord?.purchase_price ?? 0);
    const effectiveBatchId = batchId || existingBatchRecord?.id || "";
    const batchPayload = {
      medicine_id: savedMedicineId,
      supplier_id: supplierId,
      batch_number: batchNumber,
      expiry_date: expiryDate,
      stock_quantity: stockQuantity,
      purchase_price: effectivePurchasePrice,
      selling_price: sellingPrice,
      tablets_per_strip: tabletsPerStrip,
      low_stock_threshold: lowStockThreshold
    };

    const previousStock = Number(existingBatchRecord?.stock_quantity ?? 0);

    const savedBatch = effectiveBatchId
      ? await supabase.from("medicine_batches").update(batchPayload).eq("id", effectiveBatchId).select("id").single()
      : await supabase
          .from("medicine_batches")
          .upsert(batchPayload, { onConflict: "medicine_id,batch_number" })
          .select("id")
          .single();

    if (savedBatch.error) {
      redirectWithMessage("/inventory", "error", savedBatch.error.message);
    }

    const savedBatchId = (savedBatch.data as { id: string } | null)?.id;
    const movementDelta = stockQuantity - previousStock;

    if (savedBatchId && movementDelta !== 0) {
      await supabase.from("stock_movements").insert({
        medicine_id: savedMedicineId,
        batch_id: savedBatchId,
        movement_type: "adjustment",
        quantity: movementDelta,
        notes: "Manual stock adjustment",
        created_by: profile?.id ?? null
      });
    }
  }

  if (savedMedicineId) {
    await recordAuditForUser(profile?.id ?? null, "medicines", savedMedicineId, resolvedMedicineId ? "updated" : "created", {
      by: profile?.email ?? "unknown"
    });
  }

  revalidatePath("/inventory");
  revalidatePath("/dashboard");

  if (!batchNumber || !expiryDate) {
    redirectWithMessage("/inventory", "info", "Medicine saved to the catalog. Add batch number and expiry date to make it appear in inventory.");
  }

  redirectWithMessage("/inventory", "success", "Medicine and stock saved successfully.");
}

export async function archiveMedicineAction(formData: FormData) {
  const { profile } = await requireAuthenticated();
  const supabase = createAdminClient();
  const medicineId = asString(formData.get("medicine_id"));

  if (!medicineId) {
    redirect("/inventory");
  }

  await supabase.from("medicines").update({ is_active: false }).eq("id", medicineId);
  await recordAuditForUser(profile?.id ?? null, "medicines", medicineId, "archived", {});

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect("/inventory");
}

export async function deleteBatchAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const batchId = asString(formData.get("batch_id"));

  if (!batchId) {
    redirect("/inventory");
  }

  const [{ data: batch }, { count: saleItemCount }, { count: purchaseItemCount }, { count: returnItemCount }] = await Promise.all([
    supabase.from("medicine_batches").select("id, batch_number, medicine_id").eq("id", batchId).maybeSingle(),
    supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId),
    supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId),
    supabase.from("sale_return_items").select("id", { count: "exact", head: true }).eq("batch_id", batchId)
  ]);

  if (!batch) {
    redirectWithMessage("/inventory", "error", "Batch was not found.");
  }

  if ((saleItemCount ?? 0) > 0 || (purchaseItemCount ?? 0) > 0 || (returnItemCount ?? 0) > 0) {
    redirectWithMessage(
      "/inventory",
      "error",
      "This batch is linked to sales, purchases, or returns. Archive the medicine instead, or keep the batch for invoice history."
    );
  }

  await supabase.from("stock_movements").delete().eq("batch_id", batchId);
  const { error } = await supabase.from("medicine_batches").delete().eq("id", batchId);

  if (error) {
    redirectWithMessage("/inventory", "error", error.message);
  }

  await recordAuditForUser(profile.id, "medicine_batches", batchId, "deleted", {
    batch_number: String((batch as { batch_number?: string }).batch_number ?? "")
  });

  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/billing");
  redirectWithMessage("/inventory", "success", "Batch deleted successfully.");
}

export async function recordPurchaseAction(formData: FormData) {
  await requireRole("admin");
  const supabase = createClient();
  const items = parseJsonField<Array<Record<string, unknown>>>(formData.get("items_json"), []);
  const supplierId = await resolveSupplierId({
    supplierId: asString(formData.get("supplier_id")),
    supplierName: asString(formData.get("supplier_name"))
  });

  if (!items.length) {
    redirectWithMessage("/purchases", "error", "Add at least one medicine to the purchase receipt before saving.");
  }

  const { data, error } = await supabase.rpc("record_purchase", {
    p_supplier_id: supplierId,
    p_invoice_number: asString(formData.get("invoice_number")) || null,
    p_purchase_date: asString(formData.get("purchase_date")) || null,
    p_notes: asString(formData.get("notes")) || null,
    p_items: items
  });

  if (error || !data) {
    redirectWithMessage("/purchases", "error", error?.message ?? "Purchase receipt could not be recorded.");
  }

  revalidatePath("/purchases");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  redirect(`/purchases?purchase=${String(data ?? "")}`);
}

export async function recordSaleAction(formData: FormData) {
  await requireAuthenticated();
  const supabase = createClient();
  const items = parseJsonField<Array<Record<string, unknown>>>(formData.get("items_json"), []);
  const paymentMethod = asString(formData.get("payment_method")) as PaymentMethod;
  const discountAmount = asNumber(formData.get("discount_amount"));
  const taxAmount = asNumber(formData.get("tax_amount"));
  const subtotal = toMoney(
    items.reduce((total, item) => total + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0)
  );
  const totalAmount = toMoney(Math.max(subtotal - discountAmount + taxAmount, 0));
  let cashAmount = toMoney(asNumber(formData.get("cash_amount")));
  let onlineAmount = toMoney(asNumber(formData.get("online_amount")));
  let onlinePaymentMethod = asString(formData.get("online_payment_method")) || null;

  if (!items.length) {
    redirectWithMessage("/billing", "error", "Add at least one medicine to the bill before completing the sale.");
  }

  try {
    const paymentBreakdown = resolvePaymentBreakdown({
      paymentMethod,
      totalAmount,
      cashAmount,
      onlineAmount,
      onlinePaymentMethod
    });
    cashAmount = paymentBreakdown.cashAmount;
    onlineAmount = paymentBreakdown.onlineAmount;
    onlinePaymentMethod = paymentBreakdown.onlinePaymentMethod;
  } catch (error) {
    redirectWithMessage("/billing", "error", error instanceof Error ? error.message : "Payment could not be validated.");
  }

  const { data, error } = await supabase.rpc("record_sale", {
    p_customer_name: asString(formData.get("customer_name")) || null,
    p_discount_amount: discountAmount,
    p_tax_amount: taxAmount,
    p_payment_method: paymentMethod || "Cash",
    p_notes: asString(formData.get("notes")) || null,
    p_items: items,
    p_cash_amount: cashAmount,
    p_online_amount: onlineAmount,
    p_online_payment_method: onlinePaymentMethod
  });

  if (error || !data) {
    redirectWithMessage("/billing", "error", error?.message ?? "Sale could not be completed.");
  }

  revalidateOperationsPages();
  redirect(`/billing?sale=${String(data ?? "")}`);
}

export async function recordSaleReturnAction(formData: FormData) {
  await requireAuthenticated();
  const supabase = createClient();
  const items = parseJsonField<Array<Record<string, unknown>>>(formData.get("items_json"), []);
  const saleId = asString(formData.get("sale_id"));

  if (!saleId) {
    redirectWithMessage("/returns", "error", "Select a sale before processing a return.");
  }

  if (!items.length) {
    redirectWithMessage("/returns", "error", "Choose at least one item and quantity to return.");
  }

  const { data, error } = await supabase.rpc("process_sale_return", {
    p_sale_id: saleId,
    p_reason: asString(formData.get("reason")) || null,
    p_refund_amount: asNumber(formData.get("refund_amount")),
    p_items: items
  });

  if (error || !data) {
    redirectWithMessage("/returns", "error", error?.message ?? "Sale return could not be completed.");
  }

  revalidatePath("/returns");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/billing");
  redirect(`/returns?return=${String(data ?? "")}`);
}

export async function updateSaleAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const saleId = asString(formData.get("sale_id"));
  const paymentMethod = asString(formData.get("payment_method")) as PaymentMethod;
  const discountAmount = toMoney(asNumber(formData.get("discount_amount")));
  const taxAmount = toMoney(asNumber(formData.get("tax_amount")));
  let cashAmount = toMoney(asNumber(formData.get("cash_amount")));
  let onlineAmount = toMoney(asNumber(formData.get("online_amount")));
  let onlinePaymentMethod = asString(formData.get("online_payment_method")) || null;
  const items = parseJsonField<EditableSaleItemPayload[]>(formData.get("items_json"), []).map((item) => ({
    ...item,
    quantity: toQuantity(asNumber(String(item.quantity))),
    unit_price: toMoney(asNumber(String(item.unit_price)))
  }));

  if (!saleId) {
    redirectWithMessage("/billing", "error", "Select a sale before updating it.");
  }

  if (!items.length) {
    redirectWithMessage("/billing", "error", "A sale must keep at least one billed medicine.");
  }

  const [{ data: existingSale }, { data: existingItems }, { data: returnedItems }] = await Promise.all([
    supabase.from("sales").select("id, invoice_number").eq("id", saleId).maybeSingle(),
    supabase.from("sale_items").select("id, medicine_id, batch_id, quantity, unit_price").eq("sale_id", saleId),
    supabase.from("sale_return_items").select("sale_item_id, quantity").in("sale_item_id", items.map((item) => item.id))
  ]);

  if (!existingSale) {
    redirectWithMessage("/billing", "error", "Sale not found.");
  }

  const currentItems = ((existingItems as Array<Record<string, unknown>> | null) ?? []).map((item) => ({
    id: String(item.id),
    medicine_id: String(item.medicine_id),
    batch_id: String(item.batch_id),
    quantity: toQuantity(Number(item.quantity ?? 0)),
    unit_price: toMoney(Number(item.unit_price ?? 0))
  }));
  const currentItemsById = new Map(currentItems.map((item) => [item.id, item]));
  const returnedBySaleItemId = new Map<string, number>();

  (((returnedItems as Array<Record<string, unknown>> | null) ?? [])).forEach((item) => {
    const saleItemId = String(item.sale_item_id ?? "");
    returnedBySaleItemId.set(saleItemId, toQuantity((returnedBySaleItemId.get(saleItemId) ?? 0) + Number(item.quantity ?? 0)));
  });

  const additionalDemandByBatch = new Map<string, number>();

  for (const item of items) {
    const currentItem = currentItemsById.get(item.id);

    if (!currentItem) {
      redirectWithMessage("/billing", "error", "One of the sale lines could not be matched. Reload the page and try again.");
    }

    if (item.quantity <= 0) {
      redirectWithMessage("/billing", "error", "Sale item quantity must stay above zero.");
    }

    if (item.unit_price < 0) {
      redirectWithMessage("/billing", "error", "Unit price cannot be negative.");
    }

    if ((returnedBySaleItemId.get(item.id) ?? 0) > item.quantity) {
      redirectWithMessage("/billing", "error", "You cannot reduce a sale item below the quantity that has already been returned.");
    }

    const delta = toQuantity(item.quantity - currentItem.quantity);

    if (delta > 0) {
      additionalDemandByBatch.set(item.batch_id, toQuantity((additionalDemandByBatch.get(item.batch_id) ?? 0) + delta));
    }
  }

  const batchIds = Array.from(new Set(items.map((item) => item.batch_id)));
  const { data: batchRows } = await supabase.from("medicine_batches").select("id, stock_quantity").in("id", batchIds);
  const batchStockById = new Map(
    (((batchRows as Array<Record<string, unknown>> | null) ?? [])).map((row) => [String(row.id), toQuantity(Number(row.stock_quantity ?? 0))])
  );

  for (const [batchId, requiredQuantity] of additionalDemandByBatch.entries()) {
    if ((batchStockById.get(batchId) ?? 0) < requiredQuantity) {
      redirectWithMessage("/billing", "error", "Not enough stock remains to increase one of the billed quantities.");
    }
  }

  for (const item of items) {
    const currentItem = currentItemsById.get(item.id)!;
    const delta = toQuantity(item.quantity - currentItem.quantity);

    if (delta !== 0) {
      const nextStock = toQuantity((batchStockById.get(item.batch_id) ?? 0) - delta);

      if (nextStock < 0) {
        redirectWithMessage("/billing", "error", "Stock would go negative after this sale update.");
      }

      await supabase.from("medicine_batches").update({ stock_quantity: nextStock }).eq("id", item.batch_id);
      batchStockById.set(item.batch_id, nextStock);

      await supabase.from("stock_movements").insert({
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        movement_type: "adjustment",
        quantity: toQuantity(-1 * delta),
        reference_id: saleId,
        notes: `Admin edited sale ${String((existingSale as { invoice_number?: string }).invoice_number ?? "")}`,
        created_by: profile.id
      });
    }

    await supabase
      .from("sale_items")
      .update({
        quantity: item.quantity,
        unit_price: item.unit_price,
        line_total: toMoney(item.quantity * item.unit_price)
      })
      .eq("id", item.id);
  }

  const subtotal = toMoney(items.reduce((total, item) => total + item.quantity * item.unit_price, 0));
  const totalAmount = toMoney(Math.max(subtotal - discountAmount + taxAmount, 0));

  try {
    const paymentBreakdown = resolvePaymentBreakdown({
      paymentMethod,
      totalAmount,
      cashAmount,
      onlineAmount,
      onlinePaymentMethod
    });
    cashAmount = paymentBreakdown.cashAmount;
    onlineAmount = paymentBreakdown.onlineAmount;
    onlinePaymentMethod = paymentBreakdown.onlinePaymentMethod;
  } catch (error) {
    redirectWithMessage("/billing", "error", error instanceof Error ? error.message : "Payment could not be validated.");
  }

  await supabase
    .from("sales")
    .update({
      customer_name: asString(formData.get("customer_name")) || null,
      payment_method: paymentMethod,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      subtotal,
      total_amount: totalAmount,
      cash_amount: cashAmount,
      online_amount: onlineAmount,
      online_payment_method: onlinePaymentMethod,
      notes: asString(formData.get("notes")) || null
    })
    .eq("id", saleId);

  await recordAuditForUser(profile.id, "sales", saleId, "updated", {
    invoice_number: (existingSale as { invoice_number?: string }).invoice_number ?? null
  });

  revalidateOperationsPages();
  redirectWithMessage("/billing", "success", "Sale updated successfully. The invoice PDF now reflects the edited values.");
}

export async function deleteSaleAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const saleId = asString(formData.get("sale_id"));

  if (!saleId) {
    redirectWithMessage("/billing", "error", "Select a sale before deleting it.");
  }

  const [{ data: sale }, { data: saleItems }, { count: returnsCount }] = await Promise.all([
    supabase.from("sales").select("id, invoice_number").eq("id", saleId).maybeSingle(),
    supabase.from("sale_items").select("id, medicine_id, batch_id, quantity").eq("sale_id", saleId),
    supabase.from("sales_returns").select("id", { count: "exact", head: true }).eq("sale_id", saleId)
  ]);

  if (!sale) {
    redirectWithMessage("/billing", "error", "Sale not found.");
  }

  if ((returnsCount ?? 0) > 0) {
    redirectWithMessage("/billing", "error", "Delete the linked return entries first, then delete this sale.");
  }

  for (const item of ((saleItems as Array<Record<string, unknown>> | null) ?? [])) {
    const batchId = String(item.batch_id ?? "");
    const quantity = toQuantity(Number(item.quantity ?? 0));
    const medicineId = String(item.medicine_id ?? "");

    const { data: batchRow } = await supabase.from("medicine_batches").select("stock_quantity").eq("id", batchId).maybeSingle();
    const nextStock = toQuantity(Number((batchRow as { stock_quantity?: number } | null)?.stock_quantity ?? 0) + quantity);

    await supabase.from("medicine_batches").update({ stock_quantity: nextStock }).eq("id", batchId);
    await supabase.from("stock_movements").insert({
      medicine_id: medicineId,
      batch_id: batchId,
      movement_type: "adjustment",
      quantity,
      reference_id: saleId,
      notes: `Admin deleted sale ${String((sale as { invoice_number?: string }).invoice_number ?? "")}`,
      created_by: profile.id
    });
  }

  await supabase.from("stock_movements").delete().eq("reference_id", saleId).eq("movement_type", "sale");
  await supabase.from("sales").delete().eq("id", saleId);
  await recordAuditForUser(profile.id, "sales", saleId, "deleted", {
    invoice_number: (sale as { invoice_number?: string }).invoice_number ?? null
  });

  revalidateOperationsPages();
  redirectWithMessage("/billing", "success", "Sale deleted and stock restored successfully.");
}

export async function updateSaleReturnAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const saleReturnId = asString(formData.get("sale_return_id"));
  const items = parseJsonField<EditableReturnItemPayload[]>(formData.get("items_json"), []).map((item) => ({
    ...item,
    quantity: toQuantity(asNumber(String(item.quantity))),
    refund_amount: toMoney(asNumber(String(item.refund_amount)))
  }));

  if (!saleReturnId) {
    redirectWithMessage("/returns", "error", "Select a return before updating it.");
  }

  if (!items.some((item) => item.quantity > 0)) {
    redirectWithMessage("/returns", "error", "A return must keep at least one returned line. Use delete if you want to remove it completely.");
  }

  const [{ data: saleReturn }, { data: existingReturnItems }] = await Promise.all([
    supabase.from("sales_returns").select("id, sale_id").eq("id", saleReturnId).maybeSingle(),
    supabase.from("sale_return_items").select("id, sale_item_id, batch_id, quantity, refund_amount").eq("sale_return_id", saleReturnId)
  ]);

  if (!saleReturn) {
    redirectWithMessage("/returns", "error", "Return not found.");
  }

  const currentReturnItems = (((existingReturnItems as Array<Record<string, unknown>> | null) ?? [])).map((item) => ({
    id: String(item.id),
    sale_item_id: String(item.sale_item_id),
    batch_id: String(item.batch_id),
    quantity: toQuantity(Number(item.quantity ?? 0)),
    refund_amount: toMoney(Number(item.refund_amount ?? 0))
  }));
  const currentReturnItemsById = new Map(currentReturnItems.map((item) => [item.id, item]));
  const saleItemIds = Array.from(new Set(currentReturnItems.map((item) => item.sale_item_id)));

  const [{ data: saleItems }, { data: allReturnItems }, { data: batchRows }] = await Promise.all([
    supabase.from("sale_items").select("id, medicine_id, batch_id, quantity").in("id", saleItemIds),
    supabase.from("sale_return_items").select("id, sale_return_id, sale_item_id, quantity").in("sale_item_id", saleItemIds),
    supabase.from("medicine_batches").select("id, stock_quantity").in("id", currentReturnItems.map((item) => item.batch_id))
  ]);

  const soldItemsById = new Map(
    (((saleItems as Array<Record<string, unknown>> | null) ?? [])).map((item) => [
      String(item.id),
      {
        medicine_id: String(item.medicine_id),
        batch_id: String(item.batch_id),
        quantity: toQuantity(Number(item.quantity ?? 0))
      }
    ])
  );

  const otherReturnedBySaleItemId = new Map<string, number>();
  (((allReturnItems as Array<Record<string, unknown>> | null) ?? [])).forEach((item) => {
    if (String(item.sale_return_id ?? "") === saleReturnId) {
      return;
    }

    const saleItemId = String(item.sale_item_id ?? "");
    otherReturnedBySaleItemId.set(saleItemId, toQuantity((otherReturnedBySaleItemId.get(saleItemId) ?? 0) + Number(item.quantity ?? 0)));
  });

  const batchStockById = new Map(
    (((batchRows as Array<Record<string, unknown>> | null) ?? [])).map((row) => [String(row.id), toQuantity(Number(row.stock_quantity ?? 0))])
  );

  for (const item of items) {
    const currentItem = currentReturnItemsById.get(item.id);

    if (!currentItem) {
      redirectWithMessage("/returns", "error", "One of the return lines could not be matched. Reload the page and try again.");
    }

    if (item.quantity < 0) {
      redirectWithMessage("/returns", "error", "Return quantity cannot be negative.");
    }

    const soldItem = soldItemsById.get(item.sale_item_id);
    if (!soldItem) {
      redirectWithMessage("/returns", "error", "The linked original sale line could not be found.");
    }

    if (toQuantity((otherReturnedBySaleItemId.get(item.sale_item_id) ?? 0) + item.quantity) > soldItem.quantity) {
      redirectWithMessage("/returns", "error", "Return quantity cannot exceed what was originally sold.");
    }

    const stockReduction = toQuantity(currentItem.quantity - item.quantity);
    if (stockReduction > 0 && (batchStockById.get(item.batch_id) ?? 0) < stockReduction) {
      redirectWithMessage("/returns", "error", "Stock is no longer high enough to reduce one of the previously returned quantities.");
    }
  }

  for (const item of items) {
    const currentItem = currentReturnItemsById.get(item.id)!;
    const soldItem = soldItemsById.get(item.sale_item_id)!;
    const delta = toQuantity(item.quantity - currentItem.quantity);

    if (delta !== 0) {
      const nextStock = toQuantity((batchStockById.get(item.batch_id) ?? 0) + delta);
      await supabase.from("medicine_batches").update({ stock_quantity: nextStock }).eq("id", item.batch_id);
      batchStockById.set(item.batch_id, nextStock);

      await supabase.from("stock_movements").insert({
        medicine_id: soldItem.medicine_id,
        batch_id: item.batch_id,
        movement_type: "adjustment",
        quantity: delta,
        reference_id: saleReturnId,
        notes: "Admin edited sale return",
        created_by: profile.id
      });
    }

    if (item.quantity > 0) {
      await supabase
        .from("sale_return_items")
        .update({
          quantity: item.quantity,
          refund_amount: item.refund_amount
        })
        .eq("id", item.id);
    } else {
      await supabase.from("sale_return_items").delete().eq("id", item.id);
    }
  }

  const remainingItems = items.filter((item) => item.quantity > 0);
  const refundAmount = toMoney(remainingItems.reduce((total, item) => total + item.refund_amount, 0));

  await supabase
    .from("sales_returns")
    .update({
      reason: asString(formData.get("reason")) || null,
      refund_amount: refundAmount
    })
    .eq("id", saleReturnId);

  await recordAuditForUser(profile.id, "sales_returns", saleReturnId, "updated", {
    sale_id: (saleReturn as { sale_id?: string }).sale_id ?? null
  });

  revalidateOperationsPages();
  redirectWithMessage("/returns", "success", "Return updated successfully.");
}

export async function deleteSaleReturnAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const saleReturnId = asString(formData.get("sale_return_id"));

  if (!saleReturnId) {
    redirectWithMessage("/returns", "error", "Select a return before deleting it.");
  }

  const [{ data: saleReturn }, { data: returnItems }] = await Promise.all([
    supabase.from("sales_returns").select("id, sale_id").eq("id", saleReturnId).maybeSingle(),
    supabase.from("sale_return_items").select("id, sale_item_id, batch_id, quantity").eq("sale_return_id", saleReturnId)
  ]);

  if (!saleReturn) {
    redirectWithMessage("/returns", "error", "Return not found.");
  }

  const saleItemIds = (((returnItems as Array<Record<string, unknown>> | null) ?? [])).map((item) => String(item.sale_item_id ?? ""));
  const [{ data: saleItems }, { data: batchRows }] = await Promise.all([
    supabase.from("sale_items").select("id, medicine_id, batch_id").in("id", saleItemIds),
    supabase
      .from("medicine_batches")
      .select("id, stock_quantity")
      .in("id", (((returnItems as Array<Record<string, unknown>> | null) ?? [])).map((item) => String(item.batch_id ?? "")))
  ]);

  const saleItemById = new Map(
    (((saleItems as Array<Record<string, unknown>> | null) ?? [])).map((item) => [
      String(item.id),
      {
        medicine_id: String(item.medicine_id),
        batch_id: String(item.batch_id)
      }
    ])
  );
  const batchStockById = new Map(
    (((batchRows as Array<Record<string, unknown>> | null) ?? [])).map((row) => [String(row.id), toQuantity(Number(row.stock_quantity ?? 0))])
  );

  for (const item of ((returnItems as Array<Record<string, unknown>> | null) ?? [])) {
    const batchId = String(item.batch_id ?? "");
    const quantity = toQuantity(Number(item.quantity ?? 0));

    if ((batchStockById.get(batchId) ?? 0) < quantity) {
      redirectWithMessage("/returns", "error", "Stock is too low to delete this return safely because some of the restored quantity has already been used.");
    }
  }

  for (const item of ((returnItems as Array<Record<string, unknown>> | null) ?? [])) {
    const batchId = String(item.batch_id ?? "");
    const quantity = toQuantity(Number(item.quantity ?? 0));
    const saleItem = saleItemById.get(String(item.sale_item_id ?? ""));
    const nextStock = toQuantity((batchStockById.get(batchId) ?? 0) - quantity);
    batchStockById.set(batchId, nextStock);

    await supabase.from("medicine_batches").update({ stock_quantity: nextStock }).eq("id", batchId);

    if (saleItem) {
      await supabase.from("stock_movements").insert({
        medicine_id: saleItem.medicine_id,
        batch_id: batchId,
        movement_type: "adjustment",
        quantity: -1 * quantity,
        reference_id: saleReturnId,
        notes: "Admin deleted sale return",
        created_by: profile.id
      });
    }
  }

  await supabase.from("stock_movements").delete().eq("reference_id", saleReturnId).eq("movement_type", "return");
  await supabase.from("sales_returns").delete().eq("id", saleReturnId);
  await recordAuditForUser(profile.id, "sales_returns", saleReturnId, "deleted", {
    sale_id: (saleReturn as { sale_id?: string }).sale_id ?? null
  });

  revalidateOperationsPages();
  redirectWithMessage("/returns", "success", "Return deleted successfully.");
}

export async function upsertUserAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const admin = createAdminClient();
  const profileId = asString(formData.get("profile_id"));
  const email = asString(formData.get("email"));
  const fullName = asString(formData.get("full_name"));
  const role = asString(formData.get("role")) as Profile["role"];
  const password = asString(formData.get("password"));

  let userId = profileId;

  if (!profileId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (error) {
      redirect(`/users?error=${encodeURIComponent(error.message)}`);
    }

    userId = data.user.id;
  } else {
    await admin.auth.admin.updateUserById(profileId, {
      email,
      password: password || undefined,
      user_metadata: {
        full_name: fullName
      }
    });
  }

  await supabase
    .from("profiles")
    .update({
      email,
      full_name: fullName,
      role,
      permissions: [...defaultPermissions[role]],
      is_active: asBoolean(formData.get("is_active")) || !profileId
    })
    .eq("id", userId);

  await recordAuditForUser(profile?.id ?? null, "profiles", userId, profileId ? "updated" : "created", {
    role
  });

  revalidatePath("/users");
  redirect("/users");
}

export async function toggleUserStatusAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const profileId = asString(formData.get("profile_id"));
  const isActive = asBoolean(formData.get("is_active"));

  await supabase.from("profiles").update({ is_active: isActive }).eq("id", profileId);
  await recordAuditForUser(profile?.id ?? null, "profiles", profileId, isActive ? "activated" : "disabled", {});

  revalidatePath("/users");
  redirect("/users");
}

export async function updateSettingsAction(formData: FormData) {
  const { profile } = await requireRole("admin");
  const supabase = createAdminClient();
  const settingsId = asString(formData.get("settings_id"));

  await supabase
    .from("store_settings")
    .update({
      store_name: asString(formData.get("store_name")),
      store_address: asString(formData.get("store_address")) || null,
      store_contact: asString(formData.get("store_contact")) || null,
      tax_enabled: asBoolean(formData.get("tax_enabled")),
      tax_rate: asNumber(formData.get("tax_rate")),
      currency_code: asString(formData.get("currency_code")) || "INR",
      expiry_alert_days: asNumber(formData.get("expiry_alert_days")) || 45,
      default_low_stock_threshold: asNumber(formData.get("default_low_stock_threshold")) || 10
    })
    .eq("id", settingsId);

  await recordAuditForUser(profile?.id ?? null, "store_settings", settingsId, "updated", {});

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/inventory");
  redirect("/settings");
}
