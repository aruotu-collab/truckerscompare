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
import { parseShiplySearch } from "@/lib/shiply-search";
import {
  extractVisibleJobs,
  openShiplyPage,
  ShiplyAuthRequired,
  type ShiplyExtract,
} from "@/lib/shiply-session";
import { driverFacingError } from "@/lib/user-error";

export const maxDuration = 120;

export async function POST(request: Request) {
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

    const session = await createPersistedSession(contextId);
    const { browser, page } = await openShiplyPage(session.connectUrl);
    let extracted: ShiplyExtract = { jobs: [], listingCount: 0, note: null };
    try {
      const query = parseShiplySearch(await request.json().catch(() => ({})));
      extracted = await extractVisibleJobs(page, query);
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
    const message = driverFacingError(err, "Could not refresh Shiply.");
    await saveConnectionMeta(user.id, { lastError: message }).catch(() => undefined);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
