import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { projectUrl, publicKey } from "./supabase";

export async function createServerSupabase() {
  const url = projectUrl();
  const key = publicKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies; proxy and route handlers can.
        }
      },
    },
  });
}
