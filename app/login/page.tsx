import { redirect } from "next/navigation";
import { CircleAlert, ShieldCheck } from "lucide-react";

import { LoginForm } from "@/components/forms/login-form";
import { createClient } from "@/lib/supabase/server";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: {
    error?: string;
  };
}) {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl gap-8 overflow-hidden rounded-[32px] border border-white/60 bg-white/50 shadow-soft lg:grid-cols-[1.2fr_0.8fr]">
        <section className="dashboard-grid relative hidden overflow-hidden bg-slate-975 p-10 text-white lg:flex lg:flex-col lg:justify-between">
          <div className="absolute inset-0 bg-hero-grid bg-[size:36px_36px] opacity-20" />
          <div className="relative flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.25em] text-brand-200">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
              <ShieldCheck className="h-5 w-5" />
            </span>
            THE SR&apos;S PHARMACY
          </div>

          <div className="relative space-y-6">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium uppercase tracking-[0.24em] text-accent-200">
              Retail Pharmacy Operating System
            </span>
            <div className="space-y-4">
              <h1 className="max-w-xl font-display text-5xl font-semibold leading-tight text-white">
                Cloud-ready control for stock, billing, compliance, and daily pharmacy ops.
              </h1>
              <p className="max-w-lg text-base leading-7 text-slate-300">
                Monitor expiring medicines, run faster billing, manage supplier purchases, and keep every batch traceable across the store.
              </p>
            </div>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3">
            {[
              { label: "Inventory traceability", value: "Batch-wise stock and expiry control" },
              { label: "Billing flow", value: "Search-driven POS with flexible payments" },
              { label: "Admin oversight", value: "Role access, audit trail, and alerts" }
            ].map((item) => (
              <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{item.label}</p>
                <p className="mt-3 text-sm leading-6 text-slate-200">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 sm:px-10 lg:px-12">
          <div className="w-full max-w-md space-y-8">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-brand-700">Secure access</p>
              <div>
                <h2 className="font-display text-4xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
                <p className="mt-3 text-base leading-7 text-slate-600">
                  Sign in with your store account to manage billing, stock, returns, and operational alerts.
                </p>
              </div>
            </div>
            {searchParams?.error ? (
              <div className="flex items-start gap-3 rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" />
                <span>{decodeURIComponent(searchParams.error)}</span>
              </div>
            ) : null}
            <LoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
