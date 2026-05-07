import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

function getRequiredServerEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing server environment variable: ${name}`);
  }

  return value;
}

export function createAdminClient() {
  return createClient(env.nextPublicSupabaseUrl(), getRequiredServerEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

