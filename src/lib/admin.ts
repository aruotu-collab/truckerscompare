export const ADMIN_EMAIL = "aruotu@gmail.com";

export function isAdminEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ADMIN_EMAIL;
}

export function clientIp(request: Request): string | null {
  const forwarded =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-vercel-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    null
  );
}

export function geoFromHeaders(request: Request) {
  const decode = (value: string | null) => {
    if (!value) return null;
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  };
  return {
    country: decode(request.headers.get("x-vercel-ip-country")),
    region: decode(request.headers.get("x-vercel-ip-country-region")),
    city: decode(request.headers.get("x-vercel-ip-city")),
  };
}

export function clip(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const next = value.trim();
  if (!next) return null;
  return next.slice(0, max);
}
