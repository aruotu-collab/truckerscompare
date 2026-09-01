"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import { searchPlaceLabel, shiplyPullLabel } from "@/lib/format";
import { driverFacingError, readApiJson } from "@/lib/user-error";
import { WhereYouAre } from "./WhereYouAre";

export function ConnectShiply({ embedded = false }: { embedded?: boolean }) {
  const { user, ready } = useAuth();
  const {
    liveJobs,
    bookStale,
    bookPulledAt,
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

  useEffect(() => {
    if (!liveViewUrl) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [liveViewUrl]);

  if (!ready) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (!user) {
    if (embedded) return null;
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
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    void fetch("/api/shiply/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile }),
    })
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
        acceptPulledJobs(body.jobs ?? []);
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

  const locStep = embedded ? 0 : 1;
  const refreshStep = locStep + 1;
  const signInStep = connected ? refreshStep + 1 : refreshStep;

  return (
    <div className="space-y-6">
      {embedded ? null : <Intro />}

      {embedded ? null : (
      <Step n={1} title="Set where you are now">
        <p className="text-sm text-muted">
          Enter a postcode first. That is your start point — it finds more jobs
          around you, and we cost empty miles from here. A city name finds
          almost nothing.
        </p>
        <div className="mt-4">
          <WhereYouAre compact />
        </div>
      </Step>
      )}

      {connected && !liveViewUrl ? (
        <Step n={refreshStep} title="Refresh the jobs you can already see" done>
          <p className="text-sm text-muted">
            Refresh runs Shiply Local search for collections within{" "}
            {profile.maxDeadMiles > 0
              ? `${profile.maxDeadMiles} miles of ${searchPlaceLabel(profile)}`
              : `the whole country`}
            . That is the job list we rank — we do not thin it again.
          </p>
          <p className="mt-2 text-sm">
            <span className={bookStale ? "text-warn" : "text-good"}>
              {bookStale ? "Needs a refresh" : "Connected"}
            </span>
            <span className="text-muted">
              {" "}
              · {bookStale ? 0 : liveJobs.length} Shiply jobs
              {bookPulledAt ? ` · ${shiplyPullLabel(bookPulledAt)}` : ""}
            </span>
          </p>
          {bookStale ? (
            <p className="mt-2 text-sm text-muted">
              Listings that have left Shiply are hidden. Refresh to pull what is
              still live.
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy}
            onClick={refreshJobs}
            className="mt-4 min-h-12 rounded-md bg-gold px-4 py-3 text-base text-ink disabled:opacity-50 md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
          >
            {busy ? "Refreshing…" : "Refresh from Shiply"}
          </button>
        </Step>
      ) : null}

      {showSignInSteps ? (
        <Step
          n={signInStep}
          title={needsReconnect ? "Shiply needs you to sign in again" : "Sign in on Shiply"}
        >
          <ol className="list-decimal space-y-3 pl-5 text-base md:text-sm">
            <li>
              Tap{" "}
              <span className="text-text">Open Shiply sign-in</span>. Shiply
              fills this screen. Use your own Shiply email and password there.
              We never see or store them.
            </li>
            <li>
              If Shiply emails a “protect your account” link, paste that link
              into the <span className="text-text">Shiply window</span> address
              bar — not into Gmail or your phone browser. Opening it elsewhere
              signs in the wrong place.
            </li>
            <li>
              When you can see your Shiply search or dashboard, tap{" "}
              <span className="text-text">Done — pull jobs</span>.
            </li>
          </ol>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={busy}
              onClick={startSignIn}
              className="min-h-12 rounded-md bg-gold px-4 py-3 text-base text-ink disabled:opacity-50 md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
            >
              {busy ? "Starting…" : "Open Shiply sign-in"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={pullJobs}
              className="min-h-12 rounded-md border border-line px-4 py-3 text-base md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
            >
              {busy ? "Pulling…" : "I’ve signed in — pull jobs"}
            </button>
          </div>
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
        <p className="text-sm text-muted">
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

      {liveViewUrl ? (
        <ShiplyLiveView
          url={liveViewUrl}
          busy={busy}
          onPull={pullJobs}
        />
      ) : null}
    </div>
  );
}

function ShiplyLiveView({
  url,
  busy,
  onPull,
}: {
  url: string;
  busy: boolean;
  onPull: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink pt-[env(safe-area-inset-top)]">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-3 py-3">
        <div className="min-w-0">
          <p className="text-base font-medium">Shiply sign-in</p>
          <p className="text-sm text-muted">Sign in here, then tap Done.</p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={onPull}
          className="min-h-12 shrink-0 rounded-md bg-gold px-4 py-3 text-base font-medium text-ink disabled:opacity-50"
        >
          {busy ? "Pulling…" : "Done — pull jobs"}
        </button>
      </div>
      <iframe
        title="Shiply sign-in"
        src={url}
        className="min-h-0 w-full flex-1 bg-white"
        allow="clipboard-write; fullscreen"
      />
      <div className="shrink-0 border-t border-line px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block py-2 text-base text-gold"
        >
          Open in a new tab if this is blank
        </a>
      </div>
    </div>
  );
}

function Intro() {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.22em] text-gold">Live jobs</p>
      <h1 className="mt-1 text-2xl font-medium">Shiply</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Connect once, then refresh when you want new jobs. We never store your
        Shiply password.
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
          <h2 className="text-base font-medium md:text-sm">{title}</h2>
          <div className="mt-2">{children}</div>
        </div>
      </div>
    </section>
  );
}
