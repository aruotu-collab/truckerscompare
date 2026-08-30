import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { AUTH_NEXT_COOKIE, safeNextPath } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNextPath(
    url.searchParams.get("next") ?? request.cookies.get(AUTH_NEXT_COOKIE)?.value,
  );
  const fail = (message: string) => {
    const dest = new URL("/sign-in", url.origin);
    dest.searchParams.set("error", message);
    return NextResponse.redirect(dest);
  };

  if (!supabaseConfigured()) {
    return fail("Sign-in is not configured.");
  }

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const supabase = await createServerSupabase();

  const succeed = () => {
    const dest = NextResponse.redirect(new URL(next, url.origin));
    dest.cookies.set(AUTH_NEXT_COOKIE, "", { path: "/", maxAge: 0 });
    return dest;
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
    return succeed();
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash: tokenHash,
    });
    if (error) return fail(error.message);
    return succeed();
  }

  return fail("That sign-in link is missing or expired. Request a new one.");
}
