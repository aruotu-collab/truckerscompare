"use client";

import { useEffect, useRef, type ReactNode } from "react";
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

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { selectedIds, profile } = useAppState();
  const { user } = useAuth();
  const welcomeName = displayNameFromEmail(user?.email);
  const navRef = useRef<HTMLElement>(null);
  const locationLine = `${searchPlaceLabel(profile)} · ${pickupRadiusLabel(profile.maxDeadMiles)} · Home ${homePlaceLabel(profile)}`;

  useEffect(() => {
    const active = navRef.current?.querySelector("[data-active='true']");
    active?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [pathname]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-ink text-text">
      <header className="shell-header z-20 shrink-0 border-b border-line bg-ink/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur md:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="min-w-0 truncate text-base font-medium text-gold">
            TruckersCompare
          </Link>
          <Link
            href="/connect#where-you-are"
            className="shell-location-inline min-w-0 truncate text-sm text-muted hover:text-text"
          >
            {locationLine} <span className="text-gold">Change</span>
          </Link>
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
        <nav
          ref={navRef}
          aria-label="Main"
          className="shell-nav -mx-4 mt-2 flex gap-1 overflow-x-auto overscroll-x-contain px-4 md:-mx-6 md:px-6"
        >
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={active ? "true" : undefined}
                className={clsx(
                  "inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-sm font-medium",
                  active ? "bg-panel-2 text-gold" : "text-muted hover:bg-panel-2/70 hover:text-text",
                )}
              >
                {item.label}
                {item.href === "/compare" && selectedIds.length > 0 ? (
                  <span className="ml-1 tabular text-gold">{selectedIds.length}</span>
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/connect#where-you-are"
          className="shell-location-below mt-2 block break-words text-sm leading-snug text-muted"
        >
          {locationLine} <span className="text-gold">Change</span>
        </Link>
      </header>
      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-6 md:py-6">
        {children}
      </main>
    </div>
  );
}
