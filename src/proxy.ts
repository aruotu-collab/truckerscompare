import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { projectUrl, publicKey } from "@/lib/supabase";

function authCallbackUrl(request: NextRequest): URL | null {
  const incoming = request.nextUrl;
  if (incoming.pathname === "/auth/callback") return null;
  const code = incoming.searchParams.get("code");
  const tokenHash = incoming.searchParams.get("token_hash");
  if (!code && !tokenHash) return null;

  const dest = incoming.clone();
  dest.pathname = "/auth/callback";
  if (!dest.searchParams.get("next")) {
    const current = incoming.pathname;
    if (current !== "/" && !current.startsWith("/auth") && current !== "/sign-in") {
      dest.searchParams.set("next", current);
    }
  }
  return dest;
}

export async function proxy(request: NextRequest) {
  const callback = authCallbackUrl(request);
  if (callback) {
    return NextResponse.redirect(callback);
  }

  let response = NextResponse.next({ request });
  const url = projectUrl();
  const key = publicKey();
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
