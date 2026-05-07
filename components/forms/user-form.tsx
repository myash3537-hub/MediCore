import { upsertUserAction } from "@/lib/actions/pharmacy";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Profile } from "@/lib/types";

export function UserForm({
  initial,
  actionLabel
}: Readonly<{
  initial?: Partial<Profile>;
  actionLabel: string;
}>) {
  return (
    <form action={upsertUserAction} className="grid gap-4">
      <input type="hidden" name="profile_id" defaultValue={initial?.id ?? ""} />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Full name</label>
          <Input name="full_name" required defaultValue={initial?.full_name ?? ""} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Email</label>
          <Input name="email" type="email" required defaultValue={initial?.email ?? ""} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">Role</label>
          <Select name="role" defaultValue={initial?.role ?? "pharmacist"}>
            <option value="admin">Admin</option>
            <option value="pharmacist">Pharmacist</option>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-800">{initial?.id ? "Reset password" : "Password"}</label>
          <Input name="password" type="password" required={!initial?.id} placeholder={initial?.id ? "Leave blank to keep unchanged" : "Minimum secure password"} />
        </div>
      </div>
      <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" name="is_active" defaultChecked={initial?.is_active ?? true} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
        Account active
      </label>
      <Button type="submit" variant="success">
        {actionLabel}
      </Button>
    </form>
  );
}

