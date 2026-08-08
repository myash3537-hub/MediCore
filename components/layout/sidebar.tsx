"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, FileText, LayoutDashboard, Package2, Receipt, Settings, ShoppingCart, Users } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { navItems } from "@/lib/constants";
import { Branch, Profile } from "@/lib/types";
import { cn, initialsFromName } from "@/lib/utils";

const iconMap = {
  ClipboardList,
  FileText,
  LayoutDashboard,
  Package2,
  Receipt,
  Settings,
  ShoppingCart,
  Users
};

export function Sidebar({ profile, branch }: Readonly<{ profile: Profile; branch: Branch }>) {
  const pathname = usePathname();
  const allowedItems = navItems.filter((item) => !item.roles || item.roles.includes(profile.role));

  return (
    <aside className="glass-panel border-r border-white/60 p-4 lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto lg:p-6">
      <div className="scrollbar-thin relative flex min-h-full flex-col overflow-y-auto rounded-[32px] border border-white/10 bg-slate-975 p-5 pr-4 text-white shadow-[0_30px_70px_rgba(8,18,31,0.28)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(32,166,99,0.28),transparent_30%),radial-gradient(circle_at_90%_10%,rgba(38,158,162,0.22),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_28%)]" />
        <div className="relative flex items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
          <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-400 to-accent-500 text-lg font-bold text-white shadow-[0_16px_32px_rgba(32,166,99,0.22)]">
            SR
          </div>
          <div>
            <p className="font-display text-lg font-semibold leading-tight">THE SR&apos;S PHARMACY</p>
            <p className="text-sm text-slate-300">Cloud pharmacy suite</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">{branch.name}</p>
          </div>
        </div>

        <div className="relative mt-5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-xs uppercase tracking-[0.24em] text-slate-300">
          Live sync active
        </div>

        <div className="relative mt-8 flex-1 space-y-2">
          {allowedItems.map((item) => {
            const Icon = iconMap[item.icon];
            const isActive = !item.href.includes("#") && pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white",
                  (item.featured || isActive) &&
                    "bg-gradient-to-r from-brand-500/[0.22] to-accent-500/[0.14] text-white ring-1 ring-brand-300/[0.28] shadow-[0_14px_32px_rgba(32,166,99,0.12)]"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-2xl border border-transparent bg-white/0 transition group-hover:bg-white/10",
                    (item.featured || isActive) && "border-white/10 bg-white/10"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span>{item.title}</span>
              </Link>
            );
          })}
        </div>

        <div className="relative mt-5 shrink-0 rounded-[24px] border border-white/10 bg-white/[0.07] p-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold uppercase shadow-inner">
              {initialsFromName(profile.full_name ?? profile.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{profile.full_name ?? profile.email}</p>
              <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-400">{profile.role}</p>
            </div>
          </div>
          <p className="mt-4 hidden text-xs leading-5 text-slate-300 2xl:block">
            Everything important stays one click away: stock alerts, sales, supplier receipts, and daily operational actions.
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
