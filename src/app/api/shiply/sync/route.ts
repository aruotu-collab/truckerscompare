import { NextResponse } from "next/server";
import {
  browserbaseConfigured,
  createPersistedSession,
} from "@/lib/browserbase";
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
    const contextId = existing?.browserbase_context_id;
    if (!contextId) {
      return NextResponse.json(
        { error: "Connect Shiply once before refreshing." },
        { status: 400 },
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 4000));
    const session = await createPersistedSession(contextId);
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

    return NextResponse.json({ jobCount: extracted.jobs.length });
  } catch (err) {
    if (err instanceof ShiplyAuthRequired) {
      await saveConnectionMeta(user.id, {
        status: "needs_reconnect",
        lastError: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not refresh Shiply." },
      { status: 500 },
    );
  }
}
