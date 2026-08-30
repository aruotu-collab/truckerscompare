export const AUTH_NEXT_COOKIE = "tc_auth_next";

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function displayNameFromEmail(email: string | null | undefined): string {
  const local = email?.split("@")[0] ?? "";
  const base = local.split("+")[0] ?? local;
  const cleaned = base.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "there";
  return cleaned.replace(/(^|\s)\S/g, (ch) => ch.toUpperCase());
}
