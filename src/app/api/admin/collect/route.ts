import { NextResponse } from "next/server";
import { clip, clientIp, geoFromHeaders } from "@/lib/admin";
import { createServerSupabase } from "@/lib/supabase-server";

export const maxDuration = 10;

const hits = new Map<string, { count: number; reset: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  const row = hits.get(ip);
  if (!row || now > row.reset) {
    hits.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  row.count += 1;
  return row.count <= 40;
}

export async function POST(request: Request) {
  const ip = clientIp(request) ?? "unknown";
  if (!allow(ip)) {
    return NextResponse.json({ ok: true });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Bad event." }, { status: 400 });
  }

  const kind = body.kind === "click" ? "click" : body.kind === "page" ? "page" : null;
  const path = clip(body.path, 240);
  if (!kind || !path || !path.startsWith("/") || path.startsWith("//")) {
    return NextResponse.json({ error: "Bad event." }, { status: 400 });
  }
  if (path.startsWith("/api/") || path.startsWith("/admin")) {
    return NextResponse.json({ ok: true });
  }

  const geo = geoFromHeaders(request);
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();

  const { error } = await supabase.from("site_events").insert({
    kind,
    path,
    href: clip(body.href, 500),
    label: clip(body.label, 160),
    referrer: clip(body.referrer, 500),
    ip: ip === "unknown" ? null : ip,
    country: geo.country,
    region: geo.region,
    city: geo.city,
    user_agent: clip(request.headers.get("user-agent"), 300),
    user_id: data.user?.id ?? null,
    session_id: clip(body.sessionId, 80),
  });
  if (error) return NextResponse.json({ ok: true });
  return NextResponse.json({ ok: true });
}
