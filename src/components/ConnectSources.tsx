"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import {
  CONNECT_LATER,
  CONNECT_WAITLIST,
  marketplaceMeta,
  sourceLabel,
} from "@/lib/marketplaces";
import { addInterest, fetchInterest, removeInterest } from "@/lib/interest-store";
import type { JobSource } from "@/lib/types";
import { ConnectShiply } from "./ConnectShiply";
import { WhereYouAre } from "./WhereYouAre";
import { clsx } from "./clsx";

const INTEREST_KEY = "tc-source-interest-v1";

function readInterest(): JobSource[] {
  try {
    const raw = window.localStorage.getItem(INTEREST_KEY);
    return raw ? (JSON.parse(raw) as JobSource[]) : [];
  } catch {
    return [];
  }
}

export function ConnectSources() {
  const { user, ready } = useAuth();
  const { connection, liveJobs, bookStale } = useAppState();
  const [interest, setInterest] = useState<JobSource[]>([]);
  const [busySource, setBusySource] = useState<JobSource | null>(null);
  const [openShiply, setOpenShiply] = useState(true);

  useEffect(() => {
    setInterest(readInterest());
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchInterest(user.id)
      .then((remote) => {
        if (!remote.length) return;
        setInterest(remote);
        window.localStorage.setItem(INTEREST_KEY, JSON.stringify(remote));
      })
      .catch(() => undefined);
  }, [user]);

  function persist(next: JobSource[]) {
    setInterest(next);
    window.localStorage.setItem(INTEREST_KEY, JSON.stringify(next));
  }

  function toggleInterest(source: JobSource) {
    const has = interest.includes(source);
    const next = has ? interest.filter((s) => s !== source) : [...interest, source];
    persist(next);
    if (!user) return;
    setBusySource(source);
    void (has ? removeInterest(user.id, source) : addInterest(user.id, source))
      .catch(() => persist(interest))
      .finally(() => setBusySource(null));
  }

  const shiplyJobs = bookStale ? 0 : liveJobs.length;
  const shiplyStatus =
    connection?.status === "connected" && shiplyJobs > 0
      ? bookStale
        ? "Refresh needed"
        : `Connected · ${shiplyJobs} jobs`
      : "Live — sign in on Shiply";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold">Sources</p>
        <h1 className="mt-1 text-2xl font-medium">Connect</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Pull jobs from boards you already use. We rank them with your vehicle
          and costs. You still quote on their site. We never store those
          passwords.
        </p>
      </div>

      <WhereYouAre compact />

      <section className="space-y-3">
        <h2 className="text-base font-medium">Live now</h2>
        <article className="rounded-lg border border-gold/25 bg-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-medium">Shiply</h3>
              <p className="mt-1 text-sm text-muted">
                {marketplaceMeta("Shiply").region} · {marketplaceMeta("Shiply").typical}
              </p>
              <p className={clsx("mt-2 text-sm", bookStale ? "text-warn" : "text-good")}>
                {shiplyStatus}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenShiply((open) => !open)}
              className="min-h-11 rounded-md border border-line px-3 py-2 text-sm"
            >
              {openShiply ? "Hide steps" : "Show Shiply steps"}
            </button>
          </div>
          {openShiply ? (
            <div className="mt-4 border-t border-line pt-4">
              {ready && !user ? (
                <p className="text-sm">
                  <Link href="/sign-in?next=/connect" className="text-gold hover:underline">
                    Sign in to TruckersCompare
                  </Link>{" "}
                  first. Then we open Shiply in a hosted window.
                </p>
              ) : (
                <ConnectShiply embedded />
              )}
            </div>
          ) : null}
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-medium">Next — if you have an account</h2>
        <p className="text-sm text-muted">
          Same connect-once idea as Shiply. We have not signed in on these
          sites ourselves, so we will not pretend the pull works yet. If you
          use one, tell us — that is how we finish the connector.
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {CONNECT_WAITLIST.map((source) => {
            const meta = marketplaceMeta(source);
            const flagged = interest.includes(source);
            return (
              <article key={source} className="rounded-lg border border-line bg-panel p-4">
                <h3 className="text-base font-medium">{sourceLabel(source)}</h3>
                <p className="mt-1 text-sm text-muted">
                  {meta.region} · {meta.typical}
                </p>
                <p className="mt-2 text-sm text-warn">Not verified yet</p>
                <button
                  type="button"
                  disabled={busySource === source}
                  onClick={() => toggleInterest(source)}
                  className={clsx(
                    "mt-4 min-h-11 w-full rounded-md px-3 py-2 text-sm",
                    flagged ? "bg-gold text-ink" : "border border-line",
                  )}
                >
                  {flagged ? "We will use your account to test" : "I have an account"}
                </button>
              </article>
            );
          })}
        </div>
        {!user ? (
          <p className="text-sm text-muted">
            <Link href="/sign-in?next=/connect" className="text-gold hover:underline">
              Sign in
            </Link>{" "}
            so we can keep that against your account.
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-base font-medium">Later</h2>
        <p className="mt-2 text-sm text-muted">
          Same ranking engine, no connector until a driver who uses them can
          walk us through a sign-in. Freight load boards (DAT, TIMOCOM) need
          their own APIs — they are not Shiply copies.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {CONNECT_LATER.map((source) => {
            const meta = marketplaceMeta(source);
            return (
              <li key={source}>
                <span className="text-text">{sourceLabel(source)}</span>
                <span className="text-muted">
                  {" "}
                  · {meta.region} · {meta.typical}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
