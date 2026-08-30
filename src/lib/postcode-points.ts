import {
  extractOutcode,
  haversineMiles,
  isGenericMetro,
  lookupCity,
  shiplyTown,
} from "./geo";
import type { OperatorProfile, RawJob } from "./types";

export type PlaceGeo = {
  key: string;
  label: string;
  outcode: string | null;
  lat: number;
  lng: number;
  source: "outcode" | "city";
};

type RouteHit = {
  miles: number;
  minutes: number;
  source: "osrm" | "estimate";
};

const GEO_KEY = "tc-place-geo-v1";
const ROUTE_KEY = "tc-place-routes-v1";
const FAIL_KEY = "tc-place-fail-v1";

const geos = new Map<string, PlaceGeo>();
const routes = new Map<string, RouteHit>();
const failedOutcodes = new Set<string>();
let storageReady = false;

function normKey(place: string): string {
  return place.replace(/\s+/g, " ").trim().toLowerCase();
}

function pairKey(from: string, to: string): string {
  return `${normKey(from)}|${normKey(to)}`;
}

function asCity(point: { lat: number; lng: number }) {
  return { name: "", lat: point.lat, lng: point.lng, region: "" };
}

function names(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value])
    .map((part) => part.trim())
    .filter(Boolean);
}

export function townFromOutcodeRow(row: {
  parish?: string | string[];
  admin_district?: string | string[];
  admin_ward?: string | string[];
}): string {
  const parishes = names(row.parish).filter((p) => !/unparished/i.test(p));
  const wards = names(row.admin_ward);
  const district = names(row.admin_district)[0] ?? "";
  for (const parish of parishes) {
    const needle = parish.toLowerCase();
    if (wards.some((ward) => ward.toLowerCase().includes(needle))) return parish;
  }
  if (parishes.length === 1) return parishes[0]!;
  return district || parishes[0] || "";
}

export function labelFromPlace(
  place: string,
  outcode: string | null,
  apiTown: string,
): string {
  const shiply = shiplyTown(place);
  const town = shiply && !isGenericMetro(shiply) ? shiply : apiTown || shiply;
  if (town && outcode && !town.toUpperCase().includes(outcode)) {
    return `${town} ${outcode}`.slice(0, 48);
  }
  if (town) return town.slice(0, 48);
  return outcode || place.replace(/\s+/g, " ").trim().slice(0, 48);
}

function readStorage() {
  if (storageReady || typeof window === "undefined") return;
  storageReady = true;
  try {
    const geoRaw = JSON.parse(localStorage.getItem(GEO_KEY) || "{}") as Record<
      string,
      PlaceGeo
    >;
    for (const [key, value] of Object.entries(geoRaw)) geos.set(key, value);
    const routeRaw = JSON.parse(localStorage.getItem(ROUTE_KEY) || "{}") as Record<
      string,
      RouteHit
    >;
    for (const [key, value] of Object.entries(routeRaw)) routes.set(key, value);
    const failRaw = JSON.parse(localStorage.getItem(FAIL_KEY) || "[]") as string[];
    for (const code of failRaw) failedOutcodes.add(code);
  } catch {
    /* ignore a bad cache */
  }
}

function writeStorage() {
  if (typeof window === "undefined") return;
  localStorage.setItem(GEO_KEY, JSON.stringify(Object.fromEntries(geos)));
  localStorage.setItem(ROUTE_KEY, JSON.stringify(Object.fromEntries(routes)));
  localStorage.setItem(FAIL_KEY, JSON.stringify([...failedOutcodes]));
}

export function placeGeo(place: string): PlaceGeo | null {
  readStorage();
  return geos.get(normKey(place)) ?? null;
}

export function displayPlace(place: string): string {
  return placeGeo(place)?.label || place.replace(/\s+/g, " ").trim() || place;
}

export function postcodeRoad(from: string, to: string): RouteHit | null {
  readStorage();
  return routes.get(pairKey(from, to)) ?? null;
}

function milesFromPoints(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const miles = Math.round(haversineMiles(asCity(a), asCity(b)) * 1.28 * 10) / 10;
  const minutes = Math.max(8, Math.round((miles / (miles < 40 ? 28 : 42)) * 60));
  return { miles: miles < 1.5 ? 4 : miles, minutes, source: "estimate" as const };
}

function rememberGeo(place: string, geo: PlaceGeo) {
  geos.set(normKey(place), geo);
}

function rememberRoute(from: string, to: string, hit: RouteHit) {
  routes.set(pairKey(from, to), hit);
  if (normKey(from) !== normKey(to)) {
    routes.set(pairKey(to, from), hit);
  }
}

export function placesForBook(profile: OperatorProfile, jobs: RawJob[]): string[] {
  return [
    profile.searchLocation,
    profile.startingCity,
    profile.homeLocation,
    profile.homeCity,
    ...jobs.flatMap((job) => [job.pickupCity, job.deliveryCity]),
  ];
}

function cityGeo(place: string): PlaceGeo | null {
  if (extractOutcode(place)) return null;
  const city = lookupCity(place);
  if (!city) return null;
  return {
    key: normKey(place),
    label: city.name,
    outcode: null,
    lat: city.lat,
    lng: city.lng,
    source: "city",
  };
}

async function fetchOutcode(outcode: string): Promise<{
  lat: number;
  lng: number;
  town: string;
} | null> {
  const res = await fetch(
    `https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}`,
  );
  if (!res.ok) return null;
  const body = (await res.json()) as {
    result?: {
      latitude?: number;
      longitude?: number;
      parish?: string | string[];
      admin_district?: string | string[];
      admin_ward?: string | string[];
    } | null;
  };
  const row = body.result;
  if (typeof row?.latitude !== "number" || typeof row.longitude !== "number") {
    return null;
  }
  return { lat: row.latitude, lng: row.longitude, town: townFromOutcodeRow(row) };
}

async function fillMissingGeos(places: string[]): Promise<boolean> {
  let changed = false;
  const missing = places.filter((place) => {
    const key = normKey(place);
    if (!key || geos.has(key)) return false;
    const city = cityGeo(place);
    if (city) {
      rememberGeo(place, city);
      changed = true;
      return false;
    }
    const outcode = extractOutcode(place);
    return Boolean(outcode) && !failedOutcodes.has(outcode!);
  });

  for (let i = 0; i < missing.length; i += 6) {
    const chunk = missing.slice(i, i + 6);
    await Promise.all(
      chunk.map(async (place) => {
        const outcode = extractOutcode(place);
        if (!outcode) return;
        const hit = await fetchOutcode(outcode);
        if (!hit) {
          failedOutcodes.add(outcode);
          return;
        }
        rememberGeo(place, {
          key: normKey(place),
          label: labelFromPlace(place, outcode, hit.town),
          outcode,
          lat: hit.lat,
          lng: hit.lng,
          source: "outcode",
        });
        changed = true;
      }),
    );
  }
  return changed;
}

async function fillMissingRoutes(places: string[]): Promise<boolean> {
  const known = places
    .map((place) => ({ place, geo: geos.get(normKey(place)) }))
    .filter((row): row is { place: string; geo: PlaceGeo } => Boolean(row.geo));
  if (known.length < 2) return false;

  const unique: { place: string; geo: PlaceGeo }[] = [];
  const seen = new Set<string>();
  for (const row of known) {
    const stamp = `${row.geo.lat.toFixed(4)},${row.geo.lng.toFixed(4)}`;
    if (seen.has(stamp)) continue;
    seen.add(stamp);
    unique.push(row);
    if (unique.length >= 36) break;
  }
  if (unique.length < 2) return false;

  const needed = unique.some((a, i) =>
    unique.slice(i + 1).some((b) => !routes.has(pairKey(a.place, b.place))),
  );
  if (!needed) return false;

  try {
    const res = await fetch("/api/routes/table", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        points: unique.map((row) => ({
          id: row.place,
          lat: row.geo.lat,
          lng: row.geo.lng,
        })),
      }),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        pairs?: { from: string; to: string; miles: number; minutes: number }[];
      };
      for (const pair of body.pairs ?? []) {
        rememberRoute(pair.from, pair.to, {
          miles: pair.miles,
          minutes: pair.minutes,
          source: "osrm",
        });
      }
      spreadRoutes(known, unique);
      return true;
    }
  } catch {
    /* fall through to crow-fly estimates */
  }

  let changed = false;
  for (const a of known) {
    for (const b of known) {
      if (routes.has(pairKey(a.place, b.place))) continue;
      rememberRoute(a.place, b.place, milesFromPoints(a.geo, b.geo));
      changed = true;
    }
  }
  return changed;
}

function coordStamp(geo: PlaceGeo): string {
  return `${geo.lat.toFixed(4)},${geo.lng.toFixed(4)}`;
}

function spreadRoutes(
  known: { place: string; geo: PlaceGeo }[],
  unique: { place: string; geo: PlaceGeo }[],
) {
  for (const a of known) {
    for (const b of known) {
      if (routes.has(pairKey(a.place, b.place))) continue;
      const from = unique.find((row) => coordStamp(row.geo) === coordStamp(a.geo));
      const to = unique.find((row) => coordStamp(row.geo) === coordStamp(b.geo));
      if (!from || !to) continue;
      const hit = routes.get(pairKey(from.place, to.place));
      if (hit) rememberRoute(a.place, b.place, hit);
    }
  }
}

/** Pin every start, town and outcode, then fill road miles between them. */
export async function hydratePlaceGeos(places: string[]): Promise<boolean> {
  readStorage();
  const unique = [
    ...new Set(
      places.map((place) => place.replace(/\s+/g, " ").trim()).filter(Boolean),
    ),
  ];
  const geoChanged = await fillMissingGeos(unique);
  const routeChanged = await fillMissingRoutes(unique);
  if (geoChanged || routeChanged) writeStorage();
  return geoChanged || routeChanged;
}
