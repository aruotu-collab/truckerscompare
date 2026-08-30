import { nearestCity, resolvePlace } from "./geo";

export type LocatedPlace = {
  outcode: string;
  startingCity: string;
};

type PostcodeRow = {
  outcode?: string;
  admin_district?: string;
  latitude?: number;
  longitude?: number;
};

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
  const row = body.result?.[0];
  const outcode = row?.outcode?.trim() ?? "";
  if (!row || !outcode) {
    throw new Error(
      "Could not find a UK postcode for this location. Type it instead.",
    );
  }
  const fromDistrict = row.admin_district
    ? resolvePlace(row.admin_district)
    : null;
  return {
    outcode,
    startingCity:
      fromDistrict ?? nearestCity(row.latitude ?? lat, row.longitude ?? lng).name,
  };
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
