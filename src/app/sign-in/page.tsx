import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/SignInForm";

export const metadata: Metadata = {
  title: "Sign in — TruckersCompare",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Account</p>
        <h1 className="mt-1 text-2xl font-medium">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          No password. We email you a one-time link. Use the same address when
          you connect Shiply later.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-muted">Loading sign-in…</p>}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
