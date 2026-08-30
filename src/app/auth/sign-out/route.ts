import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfigured } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  if (supabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/sign-in", request.url), 303);
}
