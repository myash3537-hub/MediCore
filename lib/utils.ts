import { type ClassValue, clsx } from "clsx";
import { OnlinePaymentMethod, PaymentMethod } from "@/lib/types";

export const BRAND_NAME = "THE SR'S PHARMACY";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0
  }).format(value);
}

export function formatQuantity(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

export function formatPreciseQuantity(value: number) {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(value ?? 0));
}

type PaymentDisplay = {
  payment_method: PaymentMethod;
  cash_amount?: number | null;
  online_amount?: number | null;
  online_payment_method?: OnlinePaymentMethod | null;
};

export function formatPaymentLabel(payment: PaymentDisplay, currency = "INR") {
  if (payment.payment_method !== "Split") {
    return payment.payment_method;
  }

  const parts: string[] = [];

  if (Number(payment.cash_amount ?? 0) > 0) {
    parts.push(`Cash ${formatCurrency(Number(payment.cash_amount ?? 0), currency)}`);
  }

  if (Number(payment.online_amount ?? 0) > 0) {
    parts.push(`${payment.online_payment_method ?? "Online"} ${formatCurrency(Number(payment.online_amount ?? 0), currency)}`);
  }

  return parts.length ? `Split (${parts.join(" + ")})` : "Split";
}

export function initialsFromName(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function normalizeStoreName(value?: string | null) {
  const trimmedValue = value?.trim();

  if (!trimmedValue || trimmedValue === "MediCore Store" || trimmedValue === "MediCore") {
    return BRAND_NAME;
  }

  return trimmedValue;
}
