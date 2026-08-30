const TECHNICAL =
  /json|unexpected token|failed to execute|failed to fetch|networkerror|load failed|econnreset|etimedout|timed out|timeout|playwright|browserbase|page\.goto|net::|internal server|function invocation|syntaxerror|stack trace|unexpected end/i;

export function driverFacingError(
  raw: unknown,
  fallback = "Something went wrong. Try again.",
): string {
  const message = (raw instanceof Error ? raw.message : String(raw ?? ""))
    .replace(/\s+/g, " ")
    .trim();
  if (!message) return fallback;
  if (message.length > 180 || TECHNICAL.test(message) || /[{[]/.test(message)) {
    return fallback;
  }
  return message;
}

export function emptyResponseMessage(status: number): string {
  if (status === 401) return "Sign in to TruckersCompare first.";
  if (status === 409) return "Shiply needs you to sign in again.";
  if (status === 502 || status === 503 || status === 504 || status === 524) {
    return "Shiply took too long to answer. Try Refresh again in a minute.";
  }
  if (status >= 500) return "Refresh did not finish. Try again.";
  return "Refresh did not finish. Try again. If it keeps happening, show the sign-in steps.";
}

export async function readApiJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(emptyResponseMessage(res.status));
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(emptyResponseMessage(res.status));
  }
}
