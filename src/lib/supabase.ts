import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function projectUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return undefined;
  return raw.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function publicKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(projectUrl() && publicKey());
}

export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = projectUrl();
  const key = publicKey();
  client = url && key ? createClient(url, key) : null;
  return client;
}
