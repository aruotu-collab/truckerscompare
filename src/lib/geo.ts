import type { City } from "./types";
import matrix from "./route-matrix.json";

type RoadMatrix = {
  source: string;
  fetchedAt: string;
  miles: Record<string, number>;
  minutes: Record<string, number>;
};

const ROAD = matrix as RoadMatrix;

export const CITIES: City[] = [
  { name: "Birmingham", lat: 52.4862, lng: -1.8904, region: "West Midlands" },
  { name: "London", lat: 51.5074, lng: -0.1278, region: "South East" },
  { name: "Manchester", lat: 53.4808, lng: -2.2426, region: "North West" },
  { name: "Leeds", lat: 53.8008, lng: -1.5491, region: "Yorkshire" },
  { name: "Glasgow", lat: 55.8642, lng: -4.2518, region: "Scotland" },
  { name: "Bristol", lat: 51.4545, lng: -2.5879, region: "South West" },
  { name: "Coventry", lat: 52.4068, lng: -1.5197, region: "West Midlands" },
  { name: "Nottingham", lat: 52.9548, lng: -1.1581, region: "East Midlands" },
  { name: "Wolverhampton", lat: 52.5862, lng: -2.1288, region: "West Midlands" },
  { name: "Solihull", lat: 52.4118, lng: -1.7776, region: "West Midlands" },
  { name: "Walsall", lat: 52.5862, lng: -1.9823, region: "West Midlands" },
  { name: "Edinburgh", lat: 55.9533, lng: -3.1883, region: "Scotland" },
  { name: "Liverpool", lat: 53.4084, lng: -2.9916, region: "North West" },
  { name: "Sheffield", lat: 53.3811, lng: -1.4701, region: "Yorkshire" },
  { name: "Newcastle", lat: 54.9783, lng: -1.6178, region: "North East" },
  { name: "Cardiff", lat: 51.4816, lng: -3.1791, region: "Wales" },
  { name: "Leicester", lat: 52.6369, lng: -1.1398, region: "East Midlands" },
  { name: "Southampton", lat: 50.9097, lng: -1.4044, region: "South East" },
  { name: "Plymouth", lat: 50.3755, lng: -4.1427, region: "South West" },
  { name: "Hull", lat: 53.7678, lng: -0.3272, region: "Yorkshire" },
  { name: "Derby", lat: 52.9225, lng: -1.4746, region: "East Midlands" },
  { name: "Stoke", lat: 53.0027, lng: -2.1794, region: "West Midlands" },
  { name: "Reading", lat: 51.4543, lng: -0.9781, region: "South East" },
  { name: "Oxford", lat: 51.752, lng: -1.2577, region: "South East" },
  { name: "Cambridge", lat: 52.2053, lng: 0.1218, region: "East" },
  { name: "Norwich", lat: 52.6309, lng: 1.2974, region: "East" },
  { name: "Exeter", lat: 50.7184, lng: -3.5339, region: "South West" },
  { name: "York", lat: 53.96, lng: -1.0873, region: "Yorkshire" },
  { name: "Preston", lat: 53.7632, lng: -2.7031, region: "North West" },
  { name: "Milton Keynes", lat: 52.0406, lng: -0.7594, region: "South East" },
  { name: "Northampton", lat: 52.2405, lng: -0.9027, region: "East Midlands" },
  { name: "Peterborough", lat: 52.5695, lng: -0.2405, region: "East" },
  { name: "Swindon", lat: 51.5558, lng: -1.7797, region: "South West" },
  { name: "Ipswich", lat: 52.0567, lng: 1.1482, region: "East" },
  { name: "Aberdeen", lat: 57.1497, lng: -2.0943, region: "Scotland" },
];

export function cityByName(name: string): City {
  const found = CITIES.find((c) => c.name === name);
  if (!found) throw new Error(`Unknown city: ${name}`);
  return found;
}

export function matchCity(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = CITIES.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.name;
  const contained = CITIES.find(
    (c) => n.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(n),
  );
  return contained?.name ?? null;
}

export function haversineMiles(a: City, b: City): number {
  const r = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function pairKey(from: string, to: string): string {
  return `${from}|${to}`;
}

export function hasRoadMatrix(from: string, to: string): boolean {
  return Object.prototype.hasOwnProperty.call(ROAD.miles, pairKey(from, to));
}

/** Driving miles from the UK road matrix, with a haversine fallback. */
export function roadMiles(from: string, to: string): number {
  const hit = ROAD.miles[pairKey(from, to)];
  if (typeof hit === "number") return hit;
  if (from === to) return 4;
  return Math.round(haversineMiles(cityByName(from), cityByName(to)) * 1.28 * 10) / 10;
}

/** Driving minutes from the UK road matrix, with a speed-band fallback. */
export function roadMinutes(from: string, to: string): number {
  const hit = ROAD.minutes[pairKey(from, to)];
  if (typeof hit === "number") return hit;
  const miles = roadMiles(from, to);
  const cruisingMph = miles < 40 ? 28 : 42;
  return Math.max(8, Math.round((miles / cruisingMph) * 60));
}

export function routePairSource(from: string, to: string): "osrm" | "estimate" {
  return hasRoadMatrix(from, to) ? "osrm" : "estimate";
}

export function headingDegrees(from: string, to: string): number {
  if (from === to) return 0;
  const a = cityByName(from);
  const b = cityByName(to);
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two headings, 0–180. */
export function headingDelta(
  fromA: string,
  toA: string,
  fromB: string,
  toB: string,
): number {
  const d = Math.abs(headingDegrees(fromA, toA) - headingDegrees(fromB, toB));
  return Math.min(d, 360 - d);
}

export function regionOf(name: string): string {
  return cityByName(name).region;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
