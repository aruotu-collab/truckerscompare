import { createBrowserSupabase } from "@/lib/supabase-browser";
import type { RawJob } from "@/lib/types";

export type ConnectionStatus = "disconnected" | "connected" | "needs_reconnect";

export interface MarketplaceConnection {
  source: string;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  lastError: string | null;
  jobCount: number;
  hasContext: boolean;
}

interface ConnectionRow {
  source: string;
  status: ConnectionStatus;
  last_synced_at: string | null;
  last_error: string | null;
  job_count: number;
  browserbase_context_id?: string | null;
  browserbase_session_id?: string | null;
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
  highest_bid?: number | string | null;
  weight_kg: number | string | null;
  collection_window: string;
  delivery_window: string;
  posted_minutes_ago: number;
  quote_count: number;
  description: string;
  loading_minutes_known: boolean;
  listed_miles?: number | string | null;
  updated_at?: string | null;
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
    highestBid: row.highest_bid == null ? null : Number(row.highest_bid),
    weightKg: row.weight_kg == null ? null : Number(row.weight_kg),
    collectionWindow: row.collection_window,
    deliveryWindow: row.delivery_window,
    postedMinutesAgo: row.posted_minutes_ago,
    quoteCount: row.quote_count,
    description: row.description,
    loadingMinutesKnown: row.loading_minutes_known,
    listingUrl: row.listing_url,
    listedMiles: (() => {
      const miles = Number(row.listed_miles);
      return Number.isFinite(miles) && miles > 0 ? miles : null;
    })(),
    updatedAt: row.updated_at ?? null,
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
    highest_bid: job.highestBid && job.highestBid > 0 ? job.highestBid : null,
    weight_kg: job.weightKg,
    collection_window: job.collectionWindow,
    delivery_window: job.deliveryWindow,
    posted_minutes_ago: job.postedMinutesAgo,
    quote_count: job.quoteCount,
    description: job.description,
    loading_minutes_known: job.loadingMinutesKnown,
    listed_miles: job.listedMiles && job.listedMiles > 0 ? job.listedMiles : null,
  };
}

export async function fetchConnection(
  userId: string,
  source = "Shiply",
): Promise<MarketplaceConnection | null> {
  const supabase = createBrowserSupabase();
  const { data, error } = await supabase
    .from("marketplace_connections")
    .select("source, status, last_synced_at, last_error, job_count, browserbase_context_id")
    .eq("user_id", userId)
    .eq("source", source)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ConnectionRow;
  return {
    source: row.source,
    status: row.status,
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    lastError: row.last_error,
    jobCount: row.job_count,
    hasContext: Boolean(row.browserbase_context_id),
  };
}

const JOB_SELECT =
  "source, external_id, listing_url, pickup_city, delivery_city, category, vehicle_required, revenue, highest_bid, weight_kg, collection_window, delivery_window, posted_minutes_ago, quote_count, description, loading_minutes_known, listed_miles, updated_at";

function dropOptionalJobColumn(columns: string, message: string): string | null {
  if (/listed_miles/i.test(message) && columns.includes("listed_miles")) {
    return columns.replace(", listed_miles", "");
  }
  if (/updated_at/i.test(message) && columns.includes("updated_at")) {
    return columns.replace(", updated_at", "");
  }
  if (/highest_bid/i.test(message) && columns.includes("highest_bid")) {
    return columns.replace(", highest_bid", "");
  }
  return null;
}

function withoutOptionalJobColumns<T extends { highest_bid?: unknown; listed_miles?: unknown }>(
  row: T,
  message: string,
) {
  let next: Record<string, unknown> = { ...row };
  if (/highest_bid/i.test(message)) {
    const { highest_bid: _dropped, ...rest } = next;
    next = rest;
  }
  if (/listed_miles/i.test(message)) {
    const { listed_miles: _dropped, ...rest } = next;
    next = rest;
  }
  return next as T;
}

export async function fetchMarketplaceJobs(
  userId: string,
  source = "Shiply",
): Promise<RawJob[]> {
  const supabase = createBrowserSupabase();
  let columns = JOB_SELECT;
  for (;;) {
    const result = await supabase
      .from("marketplace_jobs")
      .select(columns)
      .eq("user_id", userId)
      .eq("source", source);
    if (!result.error) {
      return ((result.data as unknown as JobRow[] | null) ?? []).map(rowToJob);
    }
    const next = dropOptionalJobColumn(columns, result.error.message);
    if (!next) throw result.error;
    columns = next;
  }
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
    const rows = jobs.map((job) => jobToRow(userId, job));
    const first = await supabase.from("marketplace_jobs").insert(rows);
    if (first.error && /highest_bid|listed_miles/i.test(first.error.message)) {
      const stripped = rows.map((row) =>
        withoutOptionalJobColumns(row, first.error!.message),
      );
      const retry = await supabase.from("marketplace_jobs").insert(stripped);
      if (retry.error && /highest_bid|listed_miles/i.test(retry.error.message)) {
        const again = await supabase
          .from("marketplace_jobs")
          .insert(
            stripped.map((row) => withoutOptionalJobColumns(row, retry.error!.message)),
          );
        if (again.error) throw again.error;
      } else if (retry.error) {
        throw retry.error;
      }
    } else if (first.error) {
      throw first.error;
    }
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
