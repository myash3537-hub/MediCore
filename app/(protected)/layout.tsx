import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { RealtimeRefresh } from "@/components/providers/realtime-refresh";
import { getSessionContext } from "@/lib/auth";

export default async function ProtectedLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getSessionContext();

  if (!session.profile || !session.branch) {
    redirect("/login");
  }

  return (
    <>
      <RealtimeRefresh />
      <AppShell profile={session.profile} branch={session.branch}>{children}</AppShell>
    </>
  );
}
