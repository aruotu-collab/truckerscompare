"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/Auth";
import { AUTH_NEXT_COOKIE, displayNameFromEmail, isEmail, safeNextPath } from "@/lib/auth";
import { createBrowserSupabase } from "@/lib/supabase-browser";

const COOLDOWN_SECONDS = 45;

export function SignInForm() {
  const { user, ready, configured } = useAuth();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState(params.get("error") ?? "");
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => {
      setCooldown((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  async function sendLink(resend: boolean) {
    const trimmed = email.trim().toLowerCase();
    if (!isEmail(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!configured) {
      setError("Sign-in is not configured on this environment.");
      return;
    }

    setSending(true);
    setError("");
    try {
      const supabase = createBrowserSupabase();
      // Keep next out of the redirect URL — Supabase rejects query strings
      // that are not on the allowlist and falls back to the Site URL.
      document.cookie = `${AUTH_NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=3600; SameSite=Lax`;
      const { error: sendError } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (sendError) {
        setError(sendError.message);
        return;
      }
      setEmail(trimmed);
      setSentTo(trimmed);
      setCooldown(COOLDOWN_SECONDS);
      if (!resend) setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the sign-in link.");
    } finally {
      setSending(false);
    }
  }

  if (!ready) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (user) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <p className="text-sm">
          Welcome, <span className="text-gold">{displayNameFromEmail(user.email)}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={next}
            className="rounded-md bg-gold px-3 py-1.5 text-sm text-ink"
          >
            Continue
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              className="rounded-md border border-line px-3 py-1.5 text-sm"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <h2 className="text-sm font-medium">Check your email</h2>
        <p className="mt-2 text-sm text-muted">
          We sent a sign-in link to <span className="text-text">{sentTo}</span>.
          It expires shortly. Open it on this device.
        </p>
        {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={sending || cooldown > 0}
            onClick={() => void sendLink(true)}
            className="rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            {sending
              ? "Sending…"
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : "Resend link"}
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1.5 text-sm"
            onClick={() => {
              setSentTo(null);
              setCooldown(0);
              setError("");
            }}
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="rounded-lg border border-line bg-panel p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void sendLink(false);
      }}
    >
      <label htmlFor="email" className="text-sm">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@company.co.uk"
        className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold"
      />
      {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
      {!configured ? (
        <p className="mt-3 text-sm text-muted">
          Supabase is not configured, so magic links cannot be sent yet.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={sending || !configured}
        className="mt-4 rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
      >
        {sending ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
