"use client";

import { createBrowserClient as createBrowserSupabaseClient } from "@supabase/ssr";

import { env } from "@/lib/env";

export function createBrowserClient() {
  return createBrowserSupabaseClient(env.nextPublicSupabaseUrl(), env.nextPublicSupabaseAnonKey());
}

