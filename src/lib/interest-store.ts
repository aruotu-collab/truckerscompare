import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { JobSource } from "./types";

export async function fetchInterest(userId: string): Promise<JobSource[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("marketplace_interest")
    .select("source")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as { source: string }[]).map((row) => row.source as JobSource);
}

export async function addInterest(userId: string, source: JobSource): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from("marketplace_interest").upsert({
    user_id: userId,
    source,
  });
  if (error) throw error;
}

export async function removeInterest(userId: string, source: JobSource): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from("marketplace_interest")
    .delete()
    .eq("user_id", userId)
    .eq("source", source);
  if (error) throw error;
}
