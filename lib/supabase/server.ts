import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";

type CookieToSet = {
  name: string;
  value: string;
  options?: any;
};

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(env.nextPublicSupabaseUrl(), env.nextPublicSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always mutate cookies during render.
        }
      }
    }
  });
}
