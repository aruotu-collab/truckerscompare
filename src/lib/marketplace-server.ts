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
  const fields: Record<string, unknown> = {};
  if (patch.status) fields.status = patch.status;
  if (patch.lastError !== undefined) fields.last_error = patch.lastError;
  if (patch.jobCount !== undefined) fields.job_count = patch.jobCount;
  if (patch.contextId !== undefined) fields.browserbase_context_id = patch.contextId;
  if (patch.sessionId !== undefined) fields.browserbase_session_id = patch.sessionId;
  if (patch.synced) fields.last_synced_at = new Date().toISOString();

  const { data: existing, error: readError } = await supabase
    .from("marketplace_connections")
    .select("user_id")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();
  if (readError) throw readError;

  if (existing) {
    if (Object.keys(fields).length === 0) return;
    const { error } = await supabase
      .from("marketplace_connections")
      .update(fields)
      .eq("user_id", userId)
      .eq("source", source);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("marketplace_connections").insert({
    user_id: userId,
    source,
    status: patch.status ?? "disconnected",
    ...fields,
  });
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
    const rows = jobs.map((job) => jobToRow(userId, job));
    const { error } = await supabase.from("marketplace_jobs").insert(rows);
    if (error && /highest_bid/i.test(error.message)) {
      const { error: retry } = await supabase
        .from("marketplace_jobs")
        .insert(
          rows.map((row) => {
            const { highest_bid: _dropped, ...rest } = row;
            return rest;
          }),
        );
      if (retry) throw retry;
    } else if (error) {
      throw error;
    }
  }
  const { error: stampError } = await supabase
    .from("marketplace_connections")
    .update({
      last_synced_at: new Date().toISOString(),
      job_count: jobs.length,
    })
    .eq("user_id", userId)
    .eq("source", source);
  if (stampError) throw stampError;
}
