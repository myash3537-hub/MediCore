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
  userId: string | null,
  entityName: string,
  entityId: string,
  action: string,
  details: Record<string, unknown>
) {
  const supabase = createAdminClient();

  await supabase.from("audit_logs").insert({
    user_id: userId,
    entity_name: entityName,
    entity_id: entityId || null,
    action,
    details
  });
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

  if (paymentMethod === "Cash") {
    cashAmount = totalAmount;
    onlineAmount = 0;
    onlinePaymentMethod = null;
  } else if (paymentMethod === "UPI" || paymentMethod === "Card") {
    cashAmount = 0;
    onlineAmount = totalAmount;
    onlinePaymentMethod = paymentMethod;
  } else if (paymentMethod === "Split") {
    const splitDifference = Math.abs(toMoney(totalAmount - (cashAmount + onlineAmount)));

    if (!onlinePaymentMethod || !["UPI", "Card"].includes(onlinePaymentMethod)) {
      redirectWithMessage("/billing", "error", "Choose whether the online portion is paid by UPI or Card.");
    }

    if (totalAmount > 0 && (cashAmount <= 0 || onlineAmount <= 0)) {
      redirectWithMessage("/billing", "error", "Split payments must include both a cash amount and an online amount.");
    }

    if (splitDifference > 0.01) {
      redirectWithMessage("/billing", "error", "Cash and online amounts must match the final bill total.");
    }
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

  revalidatePath("/billing");
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  revalidatePath("/returns");
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
