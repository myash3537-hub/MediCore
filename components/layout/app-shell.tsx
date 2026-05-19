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
      <div className="relative min-w-0">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[360px] bg-[radial-gradient(circle_at_top,rgba(32,166,99,0.16),transparent_44%),radial-gradient(circle_at_78%_18%,rgba(38,158,162,0.18),transparent_32%)]" />
        <header className="sticky top-0 z-20 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="glass-panel relative overflow-hidden rounded-[32px] border border-white/80 px-5 py-5 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:px-6">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(32,166,99,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(38,158,162,0.14),transparent_28%)]" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="inline-flex items-center rounded-full border border-brand-200/70 bg-brand-50/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-brand-800 shadow-sm">
                    MediCore operations
                  </span>
                  <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-950 sm:text-[2.2rem]">
                    Retail pharmacy command center
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                    Run the floor, protect margins, and keep every batch, bill, and alert under one sharp operational view.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-2 rounded-2xl border border-white/80 bg-white/80 px-4 py-2 text-sm text-slate-600 shadow-sm sm:flex">
                    <Bell className="h-4 w-4 text-brand-700" />
                    Alerts stay synced across devices
                  </div>
                  <form action={signOutAction} className="hidden lg:block">
                    <Button type="submit" variant="secondary" className="bg-white/[0.88]">
                      <Users className="h-4 w-4" />
                      Switch user
                    </Button>
                  </form>
                  <form action={signOutAction} className="hidden sm:block">
                    <Button type="submit" variant="ghost" className="bg-white/[0.72] backdrop-blur">
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </Button>
                  </form>
                  <div className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/[0.82] px-4 py-2 shadow-sm">
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold text-slate-950">{profile.full_name ?? profile.email}</p>
                      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{profile.role}</p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-brand-50 text-slate-700">
                      <UserCircle2 className="h-6 w-6" />
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
