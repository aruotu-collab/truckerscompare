"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import { displayNameFromEmail } from "@/lib/auth";
import { homePlaceLabel, pickupRadiusLabel, searchPlaceLabel } from "@/lib/format";
import { clsx } from "./clsx";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/opportunities", label: "Jobs" },
  { href: "/compare", label: "Compare" },
  { href: "/profile", label: "Costs" },
  { href: "/connect", label: "Shiply" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { market, selectedIds, profile, book, liveJobs, bookStale } = useAppState();
  const { user } = useAuth();
  const welcomeName = displayNameFromEmail(user?.email);

  return (
    <div className="min-h-full overflow-x-hidden bg-ink text-text">
      <div className="flex min-h-dvh overflow-x-hidden">
        <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-panel px-4 py-5 md:flex">
          <Link href="/" className="mb-8 block">
            <div className="text-[11px] uppercase tracking-[0.28em] text-gold">Truckers</div>
            <div className="font-medium tracking-tight">Compare</div>
            <div className="mt-1 text-xs text-muted">Jobs by real profit</div>
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
          <div className="mt-auto space-y-2 border-t border-line pt-4 text-xs text-muted">
            <div className="flex items-center justify-between">
              <span>Jobs from</span>
              <span
                className={
                  book === "shiply" && !bookStale
                    ? "text-good"
                    : bookStale
                      ? "text-warn"
                      : "text-muted"
                }
              >
                {book === "shiply"
                  ? bookStale
                    ? "Shiply — refresh"
                    : `Shiply · ${liveJobs.length}`
                  : "Sample list"}
              </span>
            </div>
            <Link href="/connect#where-you-are" className="block hover:text-text">
              <div>
                {market.market.analysed} jobs · {searchPlaceLabel(profile)} ·{" "}
                {pickupRadiusLabel(profile.maxDeadMiles)}
              </div>
              <div>Home {homePlaceLabel(profile)}</div>
              <div className="mt-1 text-gold">Change location</div>
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

        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <header className="sticky top-0 z-20 border-b border-line bg-ink/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:px-6 md:pt-3">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="min-w-0 truncate text-base font-medium text-gold md:hidden">
                TruckersCompare
              </Link>
              <div className="hidden text-sm md:block">
                <Link href="/connect#where-you-are" className="text-muted hover:text-text">
                  Searching{" "}
                  <span className="text-text">{searchPlaceLabel(profile)}</span>
                  {" · "}
                  <span className="text-text">{pickupRadiusLabel(profile.maxDeadMiles)}</span>
                  {" · Home "}
                  <span className="text-text">{homePlaceLabel(profile)}</span>
                  <span className="ml-2 text-gold">Change</span>
                </Link>
              </div>
              <div className="shrink-0">
                {user ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="hidden max-w-36 truncate sm:inline">
                      <span className="text-gold">{welcomeName}</span>
                    </span>
                    <form action="/auth/sign-out" method="post">
                      <button type="submit" className="text-muted hover:text-text">
                        Sign out
                      </button>
                    </form>
                  </div>
                ) : (
                  <Link href="/sign-in" className="text-sm text-gold hover:underline">
                    Sign in
                  </Link>
                )}
              </div>
            </div>
            <Link
              href="/connect#where-you-are"
              className="mt-2 block break-words text-sm leading-snug text-muted md:hidden"
            >
              {searchPlaceLabel(profile)} · {pickupRadiusLabel(profile.maxDeadMiles)} · Home{" "}
              {homePlaceLabel(profile)}{" "}
              <span className="text-gold">Change</span>
            </Link>
          </header>
          <main className="min-w-0 flex-1 overflow-x-hidden px-4 py-4 md:px-6 md:py-6">
            {children}
          </main>
          <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t border-line bg-panel pb-[env(safe-area-inset-bottom)] md:hidden">
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
                    "flex min-h-14 items-center justify-center px-1 text-center text-sm font-medium",
                    active ? "text-gold" : "text-muted",
                  )}
                >
                  {item.label}
                  {item.href === "/compare" && selectedIds.length > 0 ? (
                    <span className="ml-0.5 tabular text-gold">{selectedIds.length}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
