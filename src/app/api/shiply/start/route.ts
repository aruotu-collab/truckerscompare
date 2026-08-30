import { NextResponse } from "next/server";
import {
  browserbaseConfigured,
  createPersistedSession,
  createShiplyContext,
} from "@/lib/browserbase";
import {
  readConnectionMeta,
  requireSignedInUser,
  saveConnectionMeta,
} from "@/lib/marketplace-server";
import { goToShiplyLogin, openShiplyPage } from "@/lib/shiply-session";
import { driverFacingError } from "@/lib/user-error";

export const maxDuration = 60;

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
    const contextId =
      existing?.browserbase_context_id ?? (await createShiplyContext(user.id));
    const session = await createPersistedSession(contextId);
    const { page } = await openShiplyPage(session.connectUrl);
    await goToShiplyLogin(page);

    await saveConnectionMeta(user.id, {
      status: existing?.status === "connected" ? "connected" : "disconnected",
      contextId,
      sessionId: session.sessionId,
      lastError: null,
    });

    return NextResponse.json({
      liveViewUrl: session.liveViewUrl,
      sessionId: session.sessionId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: driverFacingError(err, "Could not start Shiply.") },
      { status: 500 },
    );
  }
}
