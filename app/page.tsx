import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { session }
  } = await supabase.auth.getSession();

  redirect(session ? "/dashboard" : "/login");
}

