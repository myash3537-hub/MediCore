import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { Branch, Profile, UserRole } from "@/lib/types";

export const getSessionContext = cache(async () => {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    return {
      session: null,
      profile: null,
      branch: null
    };
  }

  const admin = createAdminClient();
  const selectedBranchId = cookies().get("srs_branch_id")?.value ?? "";
  const [profileResponse, branchResponse] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, role, permissions, is_active, created_at, last_seen_at")
      .eq("id", session.user.id)
      .maybeSingle(),
    selectedBranchId
      ? admin
          .from("branches")
          .select("id, name, code, is_active, created_at")
          .eq("id", selectedBranchId)
          .eq("is_active", true)
          .maybeSingle()
      : Promise.resolve({ data: null })
  ]);

  return {
    session,
    profile: (profileResponse.data as Profile | null) ?? null,
    branch: (branchResponse.data as Branch | null) ?? null
  };
});

type SessionContext = Awaited<ReturnType<typeof getSessionContext>>;
type AuthenticatedSessionContext = {
  session: NonNullable<SessionContext["session"]>;
  profile: Profile;
  branch: Branch;
};

export async function requireAuthenticated(): Promise<AuthenticatedSessionContext> {
  const sessionContext = await getSessionContext();

  if (!sessionContext.session || !sessionContext.profile?.is_active) {
    redirect("/login");
  }

  if (!sessionContext.branch) {
    redirect("/login?error=Please%20select%20a%20branch.");
  }

  return {
    session: sessionContext.session,
    profile: sessionContext.profile,
    branch: sessionContext.branch
  };
}

export async function requireRole(...roles: UserRole[]): Promise<AuthenticatedSessionContext> {
  const sessionContext = await requireAuthenticated();

  if (!sessionContext.profile || !roles.includes(sessionContext.profile.role)) {
    redirect("/dashboard");
  }

  return sessionContext;
}
