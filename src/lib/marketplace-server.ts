import { createServerSupabase } from "@/lib/supabase-server";
import { jobToRow } from "@/lib/marketplace-store";
import type { ConnectionStatus } from "@/lib/marketplace-store";
import type { RawJob } from "@/lib/types";

export async function requireSignedInUser() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { user: null, supabase };
  return { user: data.user, supabase };
}

export async function readConnectionMeta(userId: string, source = "Shiply") {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select(
      "status, job_count, last_error, browserbase_context_id, browserbase_session_id",
    )
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();
  if (error) throw error;
  return data as {
    status: ConnectionStatus;
    job_count: number;
    last_error: string | null;
    browserbase_context_id: string | null;
    browserbase_session_id: string | null;
  } | null;
}

export async function saveConnectionMeta(
  userId: string,
  patch: {
    status?: ConnectionStatus;
    lastError?: string | null;
    jobCount?: number;
    contextId?: string | null;
    sessionId?: string | null;
    synced?: boolean;
  },
  source = "Shiply",
) {
  const supabase = await createServerSupabase();
  const row: Record<string, unknown> = {
    user_id: userId,
    source,
  };
  if (patch.status) row.status = patch.status;
  if (patch.lastError !== undefined) row.last_error = patch.lastError;
  if (patch.jobCount !== undefined) row.job_count = patch.jobCount;
  if (patch.contextId !== undefined) row.browserbase_context_id = patch.contextId;
  if (patch.sessionId !== undefined) row.browserbase_session_id = patch.sessionId;
  if (patch.synced) row.last_synced_at = new Date().toISOString();
  const { error } = await supabase.from("marketplace_connections").upsert(row);
  if (error) throw error;
}

export async function saveLiveJobs(
  userId: string,
  jobs: RawJob[],
  source = "Shiply",
) {
  const supabase = await createServerSupabase();
  const { error: delError } = await supabase
    .from("marketplace_jobs")
    .delete()
    .eq("user_id", userId)
    .eq("source", source);
  if (delError) throw delError;
  if (jobs.length > 0) {
    const { error } = await supabase
      .from("marketplace_jobs")
      .insert(jobs.map((job) => jobToRow(userId, job)));
    if (error) throw error;
  }
}
