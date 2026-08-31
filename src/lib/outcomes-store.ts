import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { JobOutcome, OutcomeKind } from "./types";

interface OutcomeRow {
  id: string;
  job_id: string;
  kind: string;
  route: string;
  profit: number | string | null;
  revenue: number | string | null;
  recorded_at: string;
}

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fromRow(row: OutcomeRow): JobOutcome {
  return {
    id: row.id,
    jobId: row.job_id,
    kind: row.kind as OutcomeKind,
    route: row.route,
    profit: num(row.profit),
    revenue: num(row.revenue),
    at: row.recorded_at,
  };
}

export async function fetchOutcomes(userId: string): Promise<JobOutcome[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("job_outcomes")
    .select("id, job_id, kind, route, profit, revenue, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  return (data ?? []).map((row) => fromRow(row as OutcomeRow));
}

export async function insertOutcome(userId: string, outcome: JobOutcome): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from("job_outcomes").insert({
    id: outcome.id,
    user_id: userId,
    job_id: outcome.jobId,
    kind: outcome.kind,
    route: outcome.route,
    profit: outcome.profit,
    revenue: outcome.revenue,
    recorded_at: outcome.at,
  });
  if (error) throw error;
}
