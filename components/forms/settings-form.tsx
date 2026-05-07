import { updateSettingsAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { StoreSettings } from "@/lib/types";

export function SettingsForm({
  settings
}: Readonly<{
  settings: StoreSettings;
}>) {
  return (
    <form action={updateSettingsAction} className="grid gap-4">
      <input type="hidden" name="settings_id" value={settings.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Store name</label>
          <Input name="store_name" required defaultValue={settings.store_name} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Store contact</label>
          <Input name="store_contact" defaultValue={settings.store_contact ?? ""} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Store address</label>
        <Textarea name="store_address" defaultValue={settings.store_address ?? ""} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
          <input type="checkbox" name="tax_enabled" defaultChecked={settings.tax_enabled} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
          Enable tax
        </label>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Tax rate (%)</label>
          <Input name="tax_rate" type="number" min={0} step="0.01" defaultValue={settings.tax_rate} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Expiry alert days</label>
          <Input name="expiry_alert_days" type="number" min={1} defaultValue={settings.expiry_alert_days} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Low stock threshold</label>
          <Input name="default_low_stock_threshold" type="number" min={0} defaultValue={settings.default_low_stock_threshold} />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-semibold text-slate-800">Currency code</label>
        <Input name="currency_code" defaultValue={settings.currency_code} />
      </div>

      <Button type="submit" variant="success">
        Save settings
      </Button>
    </form>
  );
}
