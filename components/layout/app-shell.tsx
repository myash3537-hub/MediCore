import { Bell, LogOut, UserCircle2, Users } from "lucide-react";

import { signOutAction } from "@/lib/actions/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Profile } from "@/lib/types";

export function AppShell({
  children,
  profile
}: Readonly<{
  children: React.ReactNode;
  profile: Profile;
}>) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar profile={profile} />
      <div className="min-w-0">
        <header className="sticky top-0 z-20 glass-panel border-b border-white/60 px-4 py-4 shadow-sm sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-brand-700">MediCore operations</p>
              <h1 className="font-display text-2xl font-semibold text-slate-950">Retail pharmacy command center</h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm sm:flex">
                <Bell className="h-4 w-4 text-brand-700" />
                Alerts stay synced across devices
              </div>
              <form action={signOutAction} className="hidden lg:block">
                <Button type="submit" variant="secondary" className="bg-white">
                  <Users className="h-4 w-4" />
                  Switch user
                </Button>
              </form>
              <form action={signOutAction} className="hidden sm:block">
                <Button type="submit" variant="ghost" className="bg-white">
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </form>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-950">{profile.full_name ?? profile.email}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{profile.role}</p>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <UserCircle2 className="h-6 w-6" />
                </span>
              </div>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
