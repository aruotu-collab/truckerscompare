import { placeLabel } from "./geo";
import type { JobSource, RawJob, VehicleType } from "./types";

const VEHICLES = new Set<VehicleType>([
  "van",
  "luton",
  "7.5t",
  "18t",
  "artic",
  "car_transporter",
]);

export interface ImportedListing {
  externalId?: string;
  listingUrl?: string;
  pickupCity: string;
  deliveryCity: string;
  category?: string;
  vehicleRequired?: string;
  revenue: number;
  highestBid?: number | null;
  weightKg?: number | null;
  collectionWindow?: string;
  deliveryWindow?: string;
  postedMinutesAgo?: number;
  quoteCount?: number;
  description?: string;
  listedMiles?: number | null;
}

export interface ImportResult {
  jobs: RawJob[];
  errors: string[];
}

function vehicleOf(value: string | undefined): VehicleType {
  return value && VEHICLES.has(value as VehicleType)
    ? (value as VehicleType)
    : "7.5t";
}

function listingId(item: ImportedListing, index: number): string {
  const raw = item.externalId?.trim() || item.listingUrl?.trim() || `row-${index + 1}`;
  return raw.replace(/[^a-zA-Z0-9:_-]+/g, "-").slice(0, 80);
}

export function listingToJob(item: ImportedListing, index: number): RawJob | string {
  const pickup = placeLabel(item.pickupCity);
  const delivery = placeLabel(item.deliveryCity);
  if (!pickup || pickup === "Unknown") {
    return `Row ${index + 1}: missing pickup.`;
  }
  if (!delivery || delivery === "Unknown") {
    return `Row ${index + 1}: missing delivery.`;
  }
  const revenue = Number(item.revenue);
  if (!Number.isFinite(revenue) || revenue < 0) {
    return `Row ${index + 1}: revenue must be a number.`;
  }
  const id = `shiply:${listingId(item, index)}`;
  return {
    id,
    source: "Shiply" as JobSource,
    pickupCity: pickup,
    deliveryCity: delivery,
    category: item.category?.trim() || "General",
    vehicleRequired: vehicleOf(item.vehicleRequired),
    revenue,
    highestBid: (() => {
      if (revenue <= 0) return null;
      const high = Number(item.highestBid);
      return Number.isFinite(high) && high >= revenue ? high : revenue;
    })(),
    weightKg:
      item.weightKg == null || item.weightKg === undefined
        ? null
        : Number(item.weightKg),
    collectionWindow: item.collectionWindow?.trim() || "Window not given",
    deliveryWindow: item.deliveryWindow?.trim() || "Window not given",
    postedMinutesAgo: Math.max(0, Number(item.postedMinutesAgo) || 0),
    quoteCount: Math.max(0, Number(item.quoteCount) || 0),
    description: item.description?.trim() || "",
    loadingMinutesKnown: false,
    listingUrl: item.listingUrl?.trim() || null,
    listedMiles: (() => {
      const miles = Number(item.listedMiles);
      return Number.isFinite(miles) && miles > 0 ? miles : null;
    })(),
  };
}

export function parseImportedListings(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { jobs: [], errors: ["That is not valid JSON."] };
  }
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  const jobs: RawJob[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      errors.push(`Row ${index + 1}: expected an object.`);
      return;
    }
    const result = listingToJob(row as ImportedListing, index);
    if (typeof result === "string") {
      errors.push(result);
      return;
    }
    if (seen.has(result.id)) {
      errors.push(`Row ${index + 1}: duplicate listing ${result.id}.`);
      return;
    }
    seen.add(result.id);
    jobs.push(result);
  });
  return { jobs, errors };
}
