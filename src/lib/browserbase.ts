import { Browserbase } from "@browserbasehq/sdk";

export function browserbaseConfigured(): boolean {
  return Boolean(process.env.BROWSERBASE_API_KEY);
}

export function getBrowserbase(): Browserbase {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    throw new Error("Browserbase is not configured.");
  }
  return new Browserbase({ apiKey });
}

export async function createShiplyContext(userId: string) {
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
  const context = await bb.contexts.create({
    name: `tc-shiply-${userId.slice(0, 8)}-${Date.now()}`,
    ...(projectId ? { projectId } : {}),
  });
  return context.id;
}

export async function createPersistedSession(
  contextId: string,
  options?: { mobile?: boolean },
) {
  const bb = getBrowserbase();
  const projectId = process.env.BROWSERBASE_PROJECT_ID || undefined;
  const base = {
    ...(projectId ? { projectId } : {}),
    keepAlive: true,
    api_timeout: 900,
    browserSettings: {
      solveCaptchas: true,
      viewport: options?.mobile
        ? { width: 390, height: 844 }
        : { width: 1024, height: 768 },
      context: {
        id: contextId,
        persist: true,
      },
    },
  };

  let session;
  try {
    session = await bb.sessions.create({
      ...base,
      region: "eu-central-1",
      proxies: true,
    });
  } catch {
    session = await bb.sessions.create({
      ...base,
      region: "eu-central-1",
    });
  }

  const debug = await bb.sessions.debug(session.id);
  return {
    sessionId: session.id,
    connectUrl: session.connectUrl,
    liveViewUrl: debug.debuggerFullscreenUrl,
  };
}
