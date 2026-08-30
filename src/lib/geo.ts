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
  { name: "Belfast", lat: 54.5973, lng: -5.9301, region: "Northern Ireland" },
  { name: "Derry", lat: 54.9966, lng: -7.3086, region: "Northern Ireland" },
  { name: "Coleraine", lat: 55.1318, lng: -6.6685, region: "Northern Ireland" },
];

export function lookupCity(name: string): City | null {
  const exact = CITIES.find((c) => c.name === name);
  if (exact) return exact;
  const resolved = resolvePlace(name) ?? parentCityFromOutcode(name);
  if (resolved) return CITIES.find((c) => c.name === resolved) ?? null;
  return null;
}

export function cityByName(name: string): City {
  return lookupCity(name) ?? {
    name,
    lat: 52.3555,
    lng: -1.1743,
    region: "Unmapped",
  };
}

/** City used for the road matrix — E17 still costs as London. */
export function costingCity(name: string): string {
  return lookupCity(name)?.name ?? name;
}

const PLACE_ALIASES: Record<string, string> = {
  // London boroughs and common districts
  barking: "London",
  barnet: "London",
  bexley: "London",
  brent: "London",
  bromley: "London",
  camden: "London",
  croydon: "London",
  ealing: "London",
  enfield: "London",
  greenwich: "London",
  hackney: "London",
  hammersmith: "London",
  haringey: "London",
  harrow: "London",
  havering: "London",
  hillingdon: "London",
  hounslow: "London",
  islington: "London",
  kensington: "London",
  kingston: "London",
  lambeth: "London",
  lewisham: "London",
  merton: "London",
  newham: "London",
  redbridge: "London",
  richmond: "London",
  southwark: "London",
  sutton: "London",
  "tower hamlets": "London",
  "waltham forest": "London",
  walthamstow: "London",
  catford: "London",
  willesden: "London",
  harlesden: "London",
  wandsworth: "London",
  westminster: "London",
  chelsea: "London",
  fulham: "London",
  paddington: "London",
  marylebone: "London",
  shoreditch: "London",
  hoxton: "London",
  dalston: "London",
  clapham: "London",
  brixton: "London",
  peckham: "London",
  deptford: "London",
  battersea: "London",
  putney: "London",
  wimbledon: "London",
  stratford: "London",
  wembley: "London",
  heathrow: "London",
  gatwick: "London",
  watford: "London",
  romford: "London",
  ilford: "London",
  uxbridge: "London",
  hayes: "London",
  "greater london": "London",
  // Other book-city catchments
  salford: "Manchester",
  stockport: "Manchester",
  oldham: "Manchester",
  bolton: "Manchester",
  bury: "Manchester",
  rochdale: "Manchester",
  altrincham: "Manchester",
  sale: "Manchester",
  stretford: "Manchester",
  trafford: "Manchester",
  "sutton coldfield": "Birmingham",
  "west bromwich": "Birmingham",
  dudley: "Birmingham",
  smethwick: "Birmingham",
  bradford: "Leeds",
  wakefield: "Leeds",
  huddersfield: "Leeds",
  halifax: "Leeds",
  birkenhead: "Liverpool",
  bootle: "Liverpool",
  wirral: "Liverpool",
  "st helens": "Liverpool",
  gateshead: "Newcastle",
  sunderland: "Newcastle",
  durham: "Newcastle",
  bath: "Bristol",
  rotherham: "Sheffield",
  chesterfield: "Sheffield",
  barnsley: "Sheffield",
  doncaster: "Sheffield",
  mansfield: "Nottingham",
  loughborough: "Leicester",
  warwick: "Coventry",
  nuneaton: "Coventry",
  rugby: "Coventry",
  paisley: "Glasgow",
  livingston: "Edinburgh",
  newport: "Cardiff",
  portsmouth: "Southampton",
  winchester: "Southampton",
  luton: "Milton Keynes",
  bedford: "Milton Keynes",
  slough: "Reading",
  guildford: "Reading",
  swindon: "Swindon",
  // Northern Ireland — never treat Londonderry as London
  londonderry: "Derry",
  "county londonderry": "Derry",
  derry: "Derry",
  coleraine: "Coleraine",
  belfast: "Belfast",
};

function normPlace(name: string): string {
  return name.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function isWholePlace(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z])${escaped}(?:$|[^a-z])`).test(haystack);
}

export function matchCity(name: string): string | null {
  const n = normPlace(name);
  if (!n || /^[a-z]{1,2}\d/.test(n)) return null;
  if (PLACE_ALIASES[n]) return PLACE_ALIASES[n];
  const exact = CITIES.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.name;
  for (const [alias, city] of Object.entries(PLACE_ALIASES)) {
    if (isWholePlace(n, alias)) return city;
  }
  const contained = [...CITIES]
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => isWholePlace(n, c.name));
  return contained?.name ?? null;
}

export function resolvePlace(place: string): string | null {
  const raw = place.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    const hit = matchCity(part);
    if (hit) return hit;
  }
  return matchCity(raw) ?? parentCityFromOutcode(raw);
}

const FULL_POSTCODE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*\d[A-Z]{2}\b/i;
const OUTCODE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\b/i;

/** SE6 2TN → SE6, or a lone outcode. */
export function extractOutcode(place: string): string | null {
  const full = place.toUpperCase().match(FULL_POSTCODE);
  if (full?.[1]) return full[1];
  const only = place.toUpperCase().replace(/\s+/g, " ").trim();
  if (/^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(only)) return only;
  const loose = only.match(OUTCODE);
  return loose?.[1] ?? null;
}

const GENERIC_METRO = new Set([
  "london",
  "greater london",
  "birmingham",
  "manchester",
  "greater manchester",
  "glasgow",
  "leeds",
  "liverpool",
  "edinburgh",
  "bristol",
  "cardiff",
  "belfast",
]);

export function parentCityFromOutcode(name: string): string | null {
  const o = (extractOutcode(name) ?? name).toUpperCase().replace(/\s+/g, "");
  if (/^(EC|WC|SE|SW|NW)\d/.test(o)) return "London";
  if (/^[ENW]\d/.test(o)) return "London";
  if (/^M\d/.test(o)) return "Manchester";
  if (/^B\d/.test(o)) return "Birmingham";
  if (/^L\d/.test(o)) return "Liverpool";
  if (/^G\d/.test(o)) return "Glasgow";
  if (/^LS\d/.test(o)) return "Leeds";
  if (/^EH\d/.test(o)) return "Edinburgh";
  if (/^BS\d/.test(o)) return "Bristol";
  if (/^CF\d/.test(o)) return "Cardiff";
  if (/^BT\d/.test(o)) return "Belfast";
  return null;
}

/** Shiply's town plus district — "London E17", not a bare city or outcode. */
export function placeLabel(place: string): string {
  const raw = place.replace(/\s+/g, " ").trim();
  if (!raw) return "Unknown";
  const first = raw.split(",")[0]?.trim() ?? "";
  const firstNorm = normPlace(first);
  const outcode = extractOutcode(raw);
  let town = "";
  if (first && !/^[a-z]{1,2}\d/i.test(first)) {
    town =
      firstNorm === "greater london"
        ? "London"
        : firstNorm === "greater manchester"
          ? "Manchester"
          : first;
  } else if (outcode) {
    town = parentCityFromOutcode(outcode) ?? "";
  }
  if (town && outcode && !town.toUpperCase().includes(outcode)) {
    return `${town} ${outcode}`.slice(0, 48);
  }
  if (town) return town.slice(0, 48);
  if (outcode) return outcode;
  return (resolvePlace(raw) ?? raw).slice(0, 48) || "Unknown";
}

export function nearestCity(lat: number, lng: number): City {
  const here = { name: "", lat, lng, region: "" };
  let best = CITIES[0]!;
  let bestMiles = Infinity;
  for (const city of CITIES) {
    const miles = haversineMiles(here, city);
    if (miles < bestMiles) {
      best = city;
      bestMiles = miles;
    }
  }
  return best;
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
  const fromCity = costingCity(from);
  const toCity = costingCity(to);
  const cityHit = ROAD.miles[pairKey(fromCity, toCity)];
  if (typeof cityHit === "number") return cityHit;
  if (from === to) return 4;
  if (fromCity === toCity) return 4;
  return Math.round(haversineMiles(cityByName(fromCity), cityByName(toCity)) * 1.28 * 10) / 10;
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
