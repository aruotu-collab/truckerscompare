"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import { searchPlaceLabel } from "@/lib/format";
import { driverFacingError, readApiJson } from "@/lib/user-error";
import { WhereYouAre } from "./WhereYouAre";

export function ConnectShiply() {
  const { user, ready } = useAuth();
  const {
    liveJobs,
    connection,
    disconnectShiply,
    refreshShiply,
    acceptPulledJobs,
    syncFromShiply,
    profile,
  } = useAppState();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [liveViewUrl, setLiveViewUrl] = useState("");
  const [showSignInAgain, setShowSignInAgain] = useState(false);

  if (!ready) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Intro />
        <WhereYouAre />
        <div className="rounded-lg border border-line bg-panel p-5">
          <p className="text-sm">
            <Link href="/sign-in?next=/connect" className="text-gold hover:underline">
              Sign in to TruckersCompare
            </Link>{" "}
            first. Then we can open Shiply in a hosted window and save the jobs
            to your account.
          </p>
        </div>
      </div>
    );
  }

  const connected = connection?.status === "connected" && liveJobs.length > 0;
  const needsReconnect = connection?.status === "needs_reconnect";
  const firstConnect = !connected || needsReconnect || Boolean(liveViewUrl);
  const showSignInSteps = firstConnect || showSignInAgain;
  const shownError = driverFacingError(error || connection?.lastError || "", "");

  function startSignIn() {
    setBusy(true);
    setError("");
    void fetch("/api/shiply/start", { method: "POST" })
      .then(async (res) => {
        const body = await readApiJson<{
          error?: string;
          liveViewUrl?: string;
        }>(res);
        if (!res.ok) {
          throw new Error(driverFacingError(body.error, "Could not start Shiply."));
        }
        if (body.liveViewUrl) {
          setLiveViewUrl(body.liveViewUrl);
          window.open(body.liveViewUrl, "_blank", "noopener,noreferrer");
        }
      })
      .catch((err) =>
        setError(driverFacingError(err, "Could not start Shiply.")),
      )
      .finally(() => setBusy(false));
  }

  function pullJobs() {
    setBusy(true);
    setError("");
    void fetch(liveViewUrl ? "/api/shiply/finish" : "/api/shiply/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startingCity: profile.startingCity,
        searchLocation: profile.searchLocation,
        radiusMiles: profile.maxDeadMiles,
      }),
    })
      .then(async (res) => {
        const body = await readApiJson<{
          error?: string;
          jobs?: Parameters<typeof acceptPulledJobs>[0];
        }>(res);
        if (!res.ok) {
          throw new Error(driverFacingError(body.error, "Could not pull jobs."));
        }
        await refreshShiply();
        if (body.jobs?.length) acceptPulledJobs(body.jobs);
        setLiveViewUrl("");
        setShowSignInAgain(false);
      })
      .catch((err) => setError(driverFacingError(err, "Could not pull jobs.")))
      .finally(() => setBusy(false));
  }

  function refreshJobs() {
    setBusy(true);
    setError("");
    void syncFromShiply()
      .catch((err) => setError(driverFacingError(err, "Could not refresh Shiply.")))
      .finally(() => setBusy(false));
  }

  return (
    <div className="space-y-6">
      <Intro />

      <Step n={1} title="Set the Shiply search place">
        <p className="text-sm text-muted">
          Do this first. Refresh types the postcode (or place) and radius into
          Shiply Local. Starting city is only for costing.
        </p>
        <div className="mt-4">
          <WhereYouAre compact />
        </div>
      </Step>

      {connected && !liveViewUrl ? (
        <Step n={2} title="Refresh the jobs you can already see" done>
          <p className="text-sm text-muted">
            Refresh runs Shiply Local search for collections within{" "}
            {profile.maxDeadMiles > 0
              ? `${profile.maxDeadMiles} miles of ${searchPlaceLabel(profile)}`
              : `the whole country`}
            . That list is the book — we do not thin it again.
          </p>
          <p className="mt-2 text-sm">
            <span className="text-good">Connected</span>
            <span className="text-muted">
              {" "}
              · {liveJobs.length} Shiply jobs
              {connection?.lastSyncedAt
                ? ` · last refresh ${new Date(connection.lastSyncedAt).toLocaleString("en-GB")}`
                : ""}
            </span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={refreshJobs}
            className="mt-4 rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            {busy ? "Refreshing…" : "Refresh from Shiply"}
          </button>
        </Step>
      ) : null}

      {showSignInSteps ? (
        <Step
          n={connected ? 3 : 2}
          title={needsReconnect ? "Shiply needs you to sign in again" : "Sign in on Shiply"}
        >
          <ol className="list-decimal space-y-3 pl-5 text-sm">
            <li>
              Click{" "}
              <span className="text-text">Open Shiply sign-in</span>. A hosted
              window opens on the Shiply login page. Use your own Shiply email
              and password there. We never see or store them.
            </li>
            <li>
              If Shiply emails a “protect your account” link, paste that link
              into the <span className="text-text">hosted window</span> address
              bar — not into Gmail or Edge. Opening it in your own browser signs
              in the wrong place.
            </li>
            <li>
              When you can see your Shiply search or dashboard, come back here
              and click <span className="text-text">I’ve signed in — pull jobs</span>.
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={startSignIn}
              className="rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
            >
              {busy ? "Starting…" : "Open Shiply sign-in"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={pullJobs}
              className="rounded-md border border-line px-3 py-1.5 text-sm"
            >
              {busy ? "Pulling…" : "I’ve signed in — pull jobs"}
            </button>
          </div>
          {liveViewUrl ? (
            <div className="-mx-4 mt-4 overflow-hidden border-y border-line md:-mx-6 md:rounded-md md:border">
              <iframe
                title="Shiply sign-in"
                src={liveViewUrl}
                className="h-[min(88vh,920px)] w-full origin-top-left bg-white [zoom:1.35]"
                allow="clipboard-write"
              />
              <p className="border-t border-line px-3 py-2 text-xs text-muted">
                If this window is blank,{" "}
                <a
                  href={liveViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gold hover:underline"
                >
                  open Shiply sign-in in a new tab
                </a>
                .
              </p>
            </div>
          ) : null}
        </Step>
      ) : (
        <p className="text-sm text-muted">
          Refresh said sign in again?{" "}
          <button
            type="button"
            onClick={() => setShowSignInAgain(true)}
            className="text-gold hover:underline"
          >
            Show the sign-in steps
          </button>
          .
        </p>
      )}

      {shownError ? <p className="text-sm text-bad">{shownError}</p> : null}

      {connected ? (
        <p className="text-xs text-muted">
          Finished with this account on this device?{" "}
          <button
            type="button"
            disabled={busy}
            onClick={() => void disconnectShiply()}
            className="text-muted underline hover:text-text"
          >
            Disconnect Shiply
          </button>
        </p>
      ) : null}
    </div>
  );
}

function Intro() {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Marketplace</p>
      <h1 className="mt-1 text-2xl font-medium">Connect Shiply</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Do this once. After that, refresh when you want new jobs. We never
        store your Shiply password.
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  done,
  children,
}: {
  n: number;
  title: string;
  done?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start gap-3">
        <div
          className={
            done
              ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-good/20 text-xs text-good"
              : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold text-xs text-ink"
          }
        >
          {n}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">{title}</h2>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}
