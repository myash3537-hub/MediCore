import { cache } from "react";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Profile, UserRole } from "@/lib/types";

export const getSessionContext = cache(async () => {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      session: null,
      profile: null
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, full_name, role, permissions, is_active, created_at, last_seen_at")
    .eq("id", session.user.id)
    .maybeSingle();

  return {
    session,
    profile: (profile as Profile | null) ?? null
  };
});

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;
type AuthenticatedSessionContext = {
  session: NonNullable<SessionContext["session"]>;
  profile: Profile;
};

export async function requireAuthenticated(): Promise<AuthenticatedSessionContext> {
  const sessionContext = await getSessionContext();

  if (!sessionContext.session || !sessionContext.profile?.is_active) {
    redirect("/login");
  }

  return {
    session: sessionContext.session,
    profile: sessionContext.profile
  };
}

export async function requireRole(...roles: UserRole[]): Promise<AuthenticatedSessionContext> {
  const sessionContext = await requireAuthenticated();

  if (!sessionContext.profile || !roles.includes(sessionContext.profile.role)) {
    redirect("/dashboard");
  }

  return sessionContext;
}
