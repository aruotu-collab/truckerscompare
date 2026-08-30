import { marketplaceKind } from "./marketplaces";
import type { ConfidenceLevel, JobSource, ScoreBand, VehicleType, WinnerKind } from "./types";

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

export const PICKUP_RADIUS_OPTIONS = [10, 25, 40, 80, 0] as const;

export function pickupRadiusLabel(miles: number): string {
  return miles > 0 ? `${miles} miles` : "Any distance";
}

/** What Refresh types into Shiply Local — a postcode if set, otherwise the start city. */
export function searchPlaceLabel(profile: {
  searchLocation?: string | null;
  startingCity: string;
}): string {
  const typed = profile.searchLocation?.trim() ?? "";
  return typed || profile.startingCity;
}

export function routeLabel(pickup: string, delivery: string): string {
  return `${pickup} → ${delivery}`;
}

const GENERIC_LOAD = /^(general|removal|vehicle|parcels|furniture|machinery|palletised goods)$/i;

const JUNK_LOAD =
  /dimensions and sometimes a photo|sometimes a photo of the goods|add a photo|include dimensions|describe the goods|what you are sending|item list|listing details/i;

export function isJunkLoadText(text: string): boolean {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return true;
  if (GENERIC_LOAD.test(t)) return true;
  if (JUNK_LOAD.test(t)) return true;
  return false;
}

export function cargoFromListingUrl(url: string): string {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const transport = parts.findIndex((part) => part.toLowerCase() === "transport");
    const slug = transport >= 0 ? parts[transport + 1] : "";
    if (!slug || /^[A-Z0-9]{6,}$/i.test(slug)) return "";
    return decodeURIComponent(slug).replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

export function loadLabel(job: {
  category: string;
  description: string;
  listingUrl?: string | null;
}): string {
  const description = job.description.replace(/\s+/g, " ").trim();
  const category = job.category.replace(/\s+/g, " ").trim();
  const fromUrl = job.listingUrl ? cargoFromListingUrl(job.listingUrl) : "";
  if (!isJunkLoadText(description) && description.toLowerCase() !== category.toLowerCase()) {
    return description;
  }
  if (fromUrl && !isJunkLoadText(fromUrl)) return fromUrl;
  if (!isJunkLoadText(category) && category.toLowerCase() !== "general") return category;
  return fromUrl || "Load not given";
}

export function loadHeadline(job: {
  category: string;
  description: string;
  listingUrl?: string | null;
}): string {
  const first = loadLabel(job).split(/[.\n•]/)[0]?.trim() ?? "";
  if (first.length <= 72) return first || job.category;
  const cut = first.slice(0, 69);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > 40 ? cut.slice(0, atWord) : cut).trimEnd()}…`;
}

export function vehicleLabel(type: VehicleType): string {
  switch (type) {
    case "van":
      return "Van";
    case "luton":
      return "Luton";
    case "7.5t":
      return "7.5t";
    case "18t":
      return "18t";
    case "artic":
      return "Artic";
    case "car_transporter":
      return "Car transporter";
  }
}

export function hasMarketBid(job: { revenue: number }): boolean {
  return job.revenue > 0;
}

export function workingBid(job: { revenue: number; suggestedQuote?: number }): number {
  if (hasMarketBid(job)) return job.revenue;
  return job.suggestedQuote && job.suggestedQuote > 0 ? job.suggestedQuote : 0;
}

export function marketPriceLabel(job: { source: JobSource; revenue: number }): string {
  if (marketplaceKind(job.source) !== "quotes") return "Budget";
  return hasMarketBid(job) ? "Lowest bid" : "Our lowest";
}

export function highestBidOf(job: {
  source: JobSource;
  revenue: number;
  highestBid?: number | null;
}): number | null {
  if (job.source !== "Shiply" || !hasMarketBid(job)) return null;
  const high = job.highestBid ?? 0;
  return high > job.revenue ? high : null;
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
