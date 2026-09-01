import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export const maxDuration = 20;

function topCounts(
  rows: { key: string | null }[],
  limit = 12,
): { key: string; count: number }[] {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = (row.key ?? "").trim() || "(none)";
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

export async function GET() {
  const { supabase, allowed, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Not an admin account." }, { status: 403 });

  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [profiles, connections, jobs, interest, outcomes, events, today] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, display_name, email, home_city, starting_city, search_location, vehicle_type, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(80),
      supabase
        .from("marketplace_connections")
        .select("user_id, source, status, last_synced_at, job_count, last_error")
        .limit(80),
      supabase.from("marketplace_jobs").select("id", { count: "exact", head: true }),
      supabase
        .from("marketplace_interest")
        .select("user_id, source, created_at")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("job_outcomes")
        .select("user_id, kind, route, profit, recorded_at")
        .order("recorded_at", { ascending: false })
        .limit(80),
      supabase
        .from("site_events")
        .select(
          "id, created_at, kind, path, href, label, referrer, ip, country, region, city, user_id, session_id",
        )
        .order("created_at", { ascending: false })
        .limit(250),
      supabase
        .from("site_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", dayAgo),
    ]);

  const eventRows = events.error ? [] : events.data ?? [];
  const pages = eventRows.filter((row) => row.kind === "page");
  const clicks = eventRows.filter((row) => row.kind === "click");

  return NextResponse.json({
    me: user.email,
    totals: {
      users: profiles.data?.length ?? 0,
      connections: connections.error ? 0 : connections.data?.length ?? 0,
      jobs: jobs.count ?? 0,
      interest: interest.error ? 0 : interest.data?.length ?? 0,
      outcomes: outcomes.error ? 0 : outcomes.data?.length ?? 0,
      eventsToday: today.count ?? 0,
      eventsShown: eventRows.length,
    },
    users: profiles.error ? [] : profiles.data ?? [],
    connections: connections.error ? [] : connections.data ?? [],
    interest: interest.error ? [] : interest.data ?? [],
    outcomes: outcomes.error ? [] : outcomes.data ?? [],
    traffic: {
      pages: topCounts(pages.map((row) => ({ key: row.path }))),
      referrers: topCounts(pages.map((row) => ({ key: row.referrer }))),
      ips: topCounts(eventRows.map((row) => ({ key: row.ip }))),
      cities: topCounts(
        eventRows.map((row) => ({
          key: [row.city, row.country].filter(Boolean).join(", "),
        })),
      ),
      clicks: topCounts(
        clicks.map((row) => ({ key: row.label || row.href || row.path })),
      ),
    },
    events: eventRows,
  });
}
