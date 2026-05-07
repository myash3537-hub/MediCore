import Link from "next/link";
import { Activity, ClipboardList, FileText, LayoutDashboard, Package2, Receipt, Settings, ShoppingCart, Users } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { navItems } from "@/lib/constants";
import { Profile } from "@/lib/types";
import { cn, initialsFromName } from "@/lib/utils";

const iconMap = {
  Activity,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package2,
  Receipt,
  Settings,
  ShoppingCart,
  Users
};

export function Sidebar({ profile }: Readonly<{ profile: Profile }>) {
  const allowedItems = navItems.filter((item) => !item.roles || item.roles.includes(profile.role));

  return (
    <aside className="glass-panel border-r border-white/60 p-4 lg:sticky lg:top-0 lg:h-screen lg:p-6">
      <div className="flex h-full flex-col rounded-[28px] bg-slate-975 p-5 text-white shadow-panel">
        <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-brand-500 text-lg font-bold text-white">
            PK
          </div>
          <div>
            <p className="font-display text-xl font-semibold">MediCore</p>
            <p className="text-sm text-slate-300">Cloud pharmacy suite</p>
          </div>
        </div>

        <div className="mt-8 space-y-2">
          {allowedItems.map((item) => {
            const Icon = iconMap[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/8 hover:text-white",
                  item.featured && "bg-brand-500/18 text-white ring-1 ring-brand-300/20"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="mt-auto rounded-[24px] border border-white/10 bg-white/5 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold uppercase">
              {initialsFromName(profile.full_name ?? profile.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile.full_name ?? profile.email}</p>
              <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-400">{profile.role}</p>
            </div>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-300">
            Everything important stays one click away: stock alerts, sales, supplier receipts, and compliance-ready audit records.
          </p>
          <form action={signOutAction} className="mt-4">
            <button type="submit" className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/16">
              Switch user / Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
