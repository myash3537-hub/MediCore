"use client";

import { Loader2, LogIn } from "lucide-react";
import { useFormStatus } from "react-dom";

import { signInAction } from "@/lib/actions/auth";
import { Branch } from "@/lib/types";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-700"
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
      Sign in
    </button>
  );
}

export function LoginForm({
  branches
}: Readonly<{
  branches: Branch[];
}>) {
  return (
    <form action={signInAction} className="space-y-5 rounded-[28px] border border-slate-200 bg-white p-7 shadow-soft">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="branch_id">
          Branch
        </label>
        <select
          id="branch_id"
          name="branch_id"
          required
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-900 outline-none ring-0 transition focus:border-brand-400 focus:bg-white"
          defaultValue={branches[0]?.id ?? ""}
        >
          <option value="" disabled>
            Select branch
          </option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="email">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="admin@medicore.com"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          placeholder="Enter your password"
          className="h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-brand-400 focus:bg-white"
        />
      </div>

      <SubmitButton />

      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm leading-6 text-brand-900">
        Use Supabase email/password auth and seed your first admin from the SQL setup guide in the README.
      </div>
    </form>
  );
}
