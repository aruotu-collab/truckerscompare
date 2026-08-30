import { nearestCity, resolvePlace } from "./geo";

export type LocatedPlace = {
  outcode: string;
  city: string;
};

type PostcodeRow = {
  outcode?: string;
  admin_district?: string | string[];
  latitude?: number;
  longitude?: number;
};

function districtName(row: PostcodeRow): string | null {
  const raw = row.admin_district;
  const name = Array.isArray(raw) ? raw[0] : raw;
  return name?.trim() || null;
}

function cityFromRow(row: PostcodeRow, lat: number, lng: number): string {
  const district = districtName(row);
  const fromDistrict = district ? resolvePlace(district) : null;
  return fromDistrict ?? nearestCity(row.latitude ?? lat, row.longitude ?? lng).name;
}

function rowToPlace(row: PostcodeRow | undefined, lat: number, lng: number): LocatedPlace {
  const outcode = row?.outcode?.trim() ?? "";
  if (!row || !outcode) {
    throw new Error("Could not find a UK postcode for this. Check it and try again.");
  }
  return {
    outcode,
    city: cityFromRow(row, lat, lng),
  };
}

export async function placeFromCoords(
  lat: number,
  lng: number,
): Promise<LocatedPlace> {
  const url = new URL("https://api.postcodes.io/postcodes");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("limit", "1");
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(
      "Could not find a UK postcode for this location. Type it instead.",
    );
  }
  const body = (await res.json()) as { result?: PostcodeRow[] | null };
  return rowToPlace(body.result?.[0], lat, lng);
}

export function looksLikePostcode(value: string): boolean {
  return /^[A-Z]{1,2}\d{1,2}[A-Z]?(?:\s*\d[A-Z]{2})?$/i.test(value.trim());
}

export async function placeFromPostcode(value: string): Promise<LocatedPlace> {
  const typed = value.trim();
  if (!looksLikePostcode(typed)) {
    throw new Error("Enter a UK postcode such as SE6.");
  }
  const compact = typed.toUpperCase().replace(/\s+/g, "");
  const full = /^[A-Z]{1,2}\d{1,2}[A-Z]?\d[A-Z]{2}$/.test(compact);
  const path = full
    ? `https://api.postcodes.io/postcodes/${encodeURIComponent(typed.toUpperCase())}`
    : `https://api.postcodes.io/outcodes/${encodeURIComponent(compact)}`;
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error("Could not find that UK postcode. Check it and try again.");
  }
  const body = (await res.json()) as { result?: PostcodeRow | null };
  const row = body.result ?? undefined;
  return rowToPlace(row, row?.latitude ?? 0, row?.longitude ?? 0);
}

function locationError(err: GeolocationPositionError): Error {
  if (err.code === err.PERMISSION_DENIED) {
    return new Error("Location was blocked. Type your postcode instead.");
  }
  return new Error("Could not read your location. Type your postcode instead.");
}

export function locateFromBrowser(): Promise<LocatedPlace> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(
        new Error("This device cannot share location. Type your postcode instead."),
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        void placeFromCoords(pos.coords.latitude, pos.coords.longitude).then(
          resolve,
          reject,
        );
      },
      (err) => reject(locationError(err)),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60_000 },
    );
  });
}
