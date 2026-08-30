import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { RawJob } from "@/lib/types";

export type ConnectionStatus = "disconnected" | "connected" | "needs_reconnect";

export interface MarketplaceConnection {
  source: string;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  jobCount: number;
}

interface ConnectionRow {
  source: string;
  status: ConnectionStatus;
  last_synced_at: string | null;
  last_error: string | null;
  job_count: number;
}

interface JobRow {
  source: string;
  external_id: string;
  listing_url: string | null;
  pickup_city: string;
  delivery_city: string;
  category: string;
  vehicle_required: string;
  revenue: number | string;
  weight_kg: number | string | null;
  collection_window: string;
  delivery_window: string;
  posted_minutes_ago: number;
  quote_count: number;
  description: string;
  loading_minutes_known: boolean;
}

export function rowToJob(row: JobRow): RawJob {
  return {
    id: `${row.source.toLowerCase()}:${row.external_id}`,
    source: row.source as RawJob["source"],
    pickupCity: row.pickup_city,
    deliveryCity: row.delivery_city,
    category: row.category,
    vehicleRequired: row.vehicle_required as RawJob["vehicleRequired"],
    revenue: Number(row.revenue),
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    collectionWindow: row.collection_window,
    deliveryWindow: row.delivery_window,
    postedMinutesAgo: row.posted_minutes_ago,
    quoteCount: row.quote_count,
    description: row.description,
    loadingMinutesKnown: row.loading_minutes_known,
    listingUrl: row.listing_url,
  };
}

export function jobToRow(userId: string, job: RawJob) {
  const externalId = job.id.includes(":") ? job.id.slice(job.id.indexOf(":") + 1) : job.id;
  return {
    user_id: userId,
    source: job.source,
    external_id: externalId,
    listing_url: job.listingUrl ?? null,
    pickup_city: job.pickupCity,
    delivery_city: job.deliveryCity,
    category: job.category,
    vehicle_required: job.vehicleRequired,
    revenue: job.revenue,
    weight_kg: job.weightKg,
    collection_window: job.collectionWindow,
    delivery_window: job.deliveryWindow,
    posted_minutes_ago: job.postedMinutesAgo,
    quote_count: job.quoteCount,
    description: job.description,
    loading_minutes_known: job.loadingMinutesKnown,
  };
}

export async function fetchConnection(
  userId: string,
  source = "Shiply",
): Promise<MarketplaceConnection | null> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select("source, status, last_synced_at, last_error, job_count")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ConnectionRow;
  return {
    source: row.source,
    status: row.status,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    jobCount: row.job_count,
  };
}

export async function fetchMarketplaceJobs(
  userId: string,
  source = "Shiply",
): Promise<RawJob[]> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("marketplace_jobs")
    .select(
      "source, external_id, listing_url, pickup_city, delivery_city, category, vehicle_required, revenue, weight_kg, collection_window, delivery_window, posted_minutes_ago, quote_count, description, loading_minutes_known",
    )
    .eq("user_id", userId)
    .eq("source", source);
  if (error) throw error;
  return ((data as JobRow[]) ?? []).map(rowToJob);
}

export async function replaceMarketplaceJobs(
  userId: string,
  jobs: RawJob[],
  source = "Shiply",
): Promise<void> {
  const supabase = createBrowserSupabase();
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
  const { error: connError } = await supabase.from("marketplace_connections").upsert({
    user_id: userId,
    source,
    status: jobs.length > 0 ? "connected" : "disconnected",
    last_synced_at: new Date().toISOString(),
    last_error: null,
    job_count: jobs.length,
  });
  if (connError) throw connError;
}

export async function setConnectionStatus(
  userId: string,
  status: ConnectionStatus,
  source = "Shiply",
): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase.from("marketplace_connections").upsert({
    user_id: userId,
    source,
    status,
  });
  if (error) throw error;
}
