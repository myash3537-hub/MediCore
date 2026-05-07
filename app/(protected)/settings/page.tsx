import { Building2, SlidersHorizontal } from "lucide-react";

import { SettingsForm } from "@/components/forms/settings-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { requireRole } from "@/lib/auth";
import { getStoreSettings } from "@/lib/data/pharmacy";

export default async function SettingsPage() {
  await requireRole("admin");
  const settings = await getStoreSettings();

  if (!settings) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Store configuration" description="Manage branding, alerts, tax defaults, and operational preferences for the medical store." action={<Badge variant="accent">Admin only</Badge>} />
        <SettingsForm settings={settings} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Store identity" description="This information can be printed on invoices and reflected in exported documents." action={<Building2 className="h-5 w-5 text-brand-700" />} />
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            <p>
              <span className="font-semibold text-slate-950">Store name:</span> {settings.store_name}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Contact:</span> {settings.store_contact || "Not configured"}
            </p>
            <p>
              <span className="font-semibold text-slate-950">Address:</span> {settings.store_address || "Not configured"}
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Operational defaults" description="These values power expiry alerts, billing tax, and stock warning thresholds." action={<SlidersHorizontal className="h-5 w-5 text-brand-700" />} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tax</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{settings.tax_enabled ? `${settings.tax_rate}% enabled` : "Disabled"}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Expiry alert</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{settings.expiry_alert_days} days</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Low stock</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{settings.default_low_stock_threshold} units</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Currency</p>
              <p className="mt-3 text-lg font-semibold text-slate-950">{settings.currency_code}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
