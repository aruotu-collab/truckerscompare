import { NextResponse } from "next/server";
import { getBrowserbase, browserbaseConfigured } from "@/lib/browserbase";
import {
  readConnectionMeta,
  requireSignedInUser,
  saveConnectionMeta,
  saveLiveJobs,
} from "@/lib/marketplace-server";
import {
  extractVisibleJobs,
  openShiplyPage,
  ShiplyAuthRequired,
  type ShiplyExtract,
} from "@/lib/shiply-session";
import { driverFacingError } from "@/lib/user-error";

export const maxDuration = 120;

export async function POST() {
  if (!browserbaseConfigured()) {
    return NextResponse.json(
      { error: "Browserbase is not configured on this environment." },
      { status: 503 },
    );
  }

  const { user } = await requireSignedInUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  try {
    const existing = await readConnectionMeta(user.id);
    const sessionId = existing?.browserbase_session_id;
    if (!sessionId) {
      return NextResponse.json(
        { error: "Start a Shiply sign-in first." },
        { status: 400 },
      );
    }

    const bb = getBrowserbase();
    const session = await bb.sessions.retrieve(sessionId);
    if (!session.connectUrl) {
      return NextResponse.json(
        { error: "That Shiply window has closed. Open sign-in again." },
        { status: 400 },
      );
    }
    const { browser, page } = await openShiplyPage(session.connectUrl);
    let extracted: ShiplyExtract = { jobs: [], listingCount: 0, note: null };
    try {
      extracted = await extractVisibleJobs(page);
    } finally {
      await browser.close().catch(() => undefined);
    }

    await saveLiveJobs(user.id, extracted.jobs);
    await saveConnectionMeta(user.id, {
      status: extracted.jobs.length > 0 ? "connected" : "disconnected",
      sessionId: null,
      jobCount: extracted.jobs.length,
      lastError: extracted.jobs.length === 0 ? extracted.note : null,
      synced: true,
    });

    return NextResponse.json({
      jobCount: extracted.jobs.length,
      jobs: extracted.jobs,
    });
  } catch (err) {
    if (err instanceof ShiplyAuthRequired) {
      await saveConnectionMeta(user.id, {
        status: "needs_reconnect",
        lastError: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = driverFacingError(err, "Could not finish pulling jobs.");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
