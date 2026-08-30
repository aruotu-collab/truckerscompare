import { createBrowserClient } from "@supabase/ssr";
import { projectUrl, publicKey } from "./supabase";

export function createBrowserSupabase() {
  const url = projectUrl();
  const key = publicKey();
  if (!url || !key) {
    throw new Error("Supabase is not configured");
  }
  return createBrowserClient(url, key);
}
