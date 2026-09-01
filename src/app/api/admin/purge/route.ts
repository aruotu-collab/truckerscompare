import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-server";

export async function POST() {
  const { supabase, allowed, user } = await requireAdmin();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: "Not an admin account." }, { status: 403 });

  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { error, count } = await supabase
    .from("site_events")
    .delete({ count: "exact" })
    .lt("created_at", cutoff);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: count ?? 0 });
}
