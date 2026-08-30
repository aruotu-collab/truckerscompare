"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import { displayNameFromEmail } from "@/lib/auth";
import { supabaseConfigured } from "@/lib/supabase";
import { clsx } from "./clsx";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/compare", label: "Compare" },
  { href: "/profile", label: "Vehicle & costs" },
  { href: "/connect", label: "Shiply" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { market, selectedIds, profile, book, liveJobs } = useAppState();
  const { user } = useAuth();
  const welcomeName = displayNameFromEmail(user?.email);

  return (
    <div className="min-h-full bg-ink text-text">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
          <Link href="/" className="mb-8 block">
            <div className="text-[11px] uppercase tracking-[0.28em] text-gold">Truckers</div>
            <div className="font-medium tracking-tight">Compare</div>
            <div className="mt-1 text-[11px] text-muted">Opportunity intelligence</div>
          </Link>
          <nav className="flex flex-1 flex-col gap-1">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-md px-2.5 py-2 text-sm",
                    active
                      ? "bg-panel-2 text-text"
                      : "text-muted hover:bg-panel-2/70 hover:text-text",
                  )}
                >
                  <span className="flex items-center justify-between">
                    {item.label}
                    {item.href === "/compare" && selectedIds.length > 0 ? (
                      <span className="tabular text-[11px] text-gold">{selectedIds.length}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto space-y-2 border-t border-line pt-4 text-[11px] text-muted">
            <div className="flex items-center justify-between">
              <span>Book</span>
              <span className={book === "shiply" ? "text-good" : "text-muted"}>
                {book === "shiply"
                  ? `Shiply · ${liveJobs.length}`
                  : "Demo book"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase</span>
              <span className={supabaseConfigured() ? "text-good" : "text-muted"}>
                {supabaseConfigured() ? "Connected" : "Not configured"}
              </span>
            </div>
            <Link href="/connect#where-you-are" className="block hover:text-text">
              <div>
                {market.market.analysed} jobs · {profile.startingCity}
              </div>
              <div>Home {profile.homeCity}</div>
            </Link>
            <div className="pt-1">
              {user ? (
                <span className="text-text">Welcome, {welcomeName}</span>
              ) : (
                <Link href="/sign-in" className="text-gold hover:underline">
                  Sign in
                </Link>
              )}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-ink/90 px-4 py-3 backdrop-blur md:px-6">
            <div className="md:hidden">
              <div className="text-[11px] uppercase tracking-[0.28em] text-gold">TruckersCompare</div>
            </div>
            <div className="hidden text-sm text-muted md:block">
              <Link href="/connect#where-you-are" className="hover:text-text">
                Starting <span className="text-text">{profile.startingCity}</span>
                <span className="mx-2 text-line">/</span>
                Home <span className="text-text">{profile.homeCity}</span>
              </Link>
              <span className="mx-2 text-line">/</span>
              <span className="tabular">{market.market.analysed} analysed</span>
            </div>
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-2 text-xs">
                  <span>
                    Welcome, <span className="text-gold">{welcomeName}</span>
                  </span>
                  <form action="/auth/sign-out" method="post">
                    <button
                      type="submit"
                      className="text-muted hover:text-text"
                    >
                      Sign out
                    </button>
                  </form>
                </div>
              ) : (
                <Link href="/sign-in" className="text-xs text-gold hover:underline">
                  Sign in
                </Link>
              )}
              <div className="text-[11px] uppercase tracking-wider text-muted">
                {market.market.qualityLabel} · {market.market.quality}/100
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-5 md:px-6 md:py-6">{children}</main>
          <nav className="sticky bottom-0 grid grid-cols-5 border-t border-line bg-panel md:hidden">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "py-3 text-center text-[11px]",
                    active ? "text-gold" : "text-muted",
                  )}
                >
                  {item.label === "Vehicle & costs" ? "Profile" : item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
