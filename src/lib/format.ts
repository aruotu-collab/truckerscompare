import type { ConfidenceLevel, JobSource, ScoreBand, WinnerKind } from "./types";

export function gbp(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function num(n: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function hoursLabel(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function milesLabel(n: number): string {
  return `${Math.round(n)} mi`;
}

export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

export function postedLabel(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hours = Math.round(minutesAgo / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function bandLabel(band: ScoreBand): string {
  return band[0]!.toUpperCase() + band.slice(1);
}

export function winnerLabel(kind: WinnerKind): string {
  switch (kind) {
    case "best_overall":
      return "Best Overall";
    case "highest_profit":
      return "Highest Profit";
    case "best_per_hour":
      return "Best £/hour";
    case "lowest_dead":
      return "Lowest Dead Miles";
    case "towards_home":
      return "Best Towards Home";
    case "best_combination":
      return "Best Combination";
  }
}

export function confidenceLabel(level: ConfidenceLevel): string {
  return level[0]!.toUpperCase() + level.slice(1);
}

export function betterThan(percentileFromBottom: number): string {
  const better = Math.round(percentileFromBottom);
  if (better >= 97) return `Top ${100 - better}% today`;
  return `Better than ${better}% today`;
}

export function signedGbp(n: number): string {
  const abs = gbp(Math.abs(n));
  if (n > 0) return `+${abs}`;
  if (n < 0) return `−${abs.replace("£", "£")}`;
  return abs;
}

export function routeLabel(pickup: string, delivery: string): string {
  return `${pickup} → ${delivery}`;
}

export function marketPriceLabel(source: JobSource): string {
  return source === "Shiply" ? "Lowest bid" : "Budget";
}

export function jobPath(id: string): string {
  return `/opportunities/${encodeURIComponent(id)}`;
}

export function normalizeJobId(id: string | string[] | undefined): string {
  const raw = Array.isArray(id) ? id[0] ?? "" : id ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
