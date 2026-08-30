"use client";

import Link from "next/link";
import { CITIES } from "@/lib/geo";
import { PICKUP_RADIUS_OPTIONS, pickupRadiusLabel, searchPlaceLabel } from "@/lib/format";
import { useAppState } from "@/context/AppState";
import { clsx } from "./clsx";

export function PickupRadius({
  value,
  onChange,
}: {
  value: number;
  onChange: (miles: number) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
        Radius from the Shiply search place
      </span>
      <div className="flex flex-wrap gap-2">
        {PICKUP_RADIUS_OPTIONS.map((miles) => {
          const active = value === miles;
          return (
            <button
              key={miles}
              type="button"
              onClick={() => onChange(miles)}
              className={clsx(
                "rounded-md px-2.5 py-1.5 text-sm",
                active
                  ? "bg-gold text-ink"
                  : "border border-line text-muted hover:border-gold/40 hover:text-text",
              )}
            >
              {miles > 0 ? `${miles} mi` : "Any"}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function WhereYouAre({ compact = false }: { compact?: boolean }) {
  const { profile, setProfile } = useAppState();

  return (
    <div
      id="where-you-are"
      className="rounded-lg border border-gold/25 bg-panel p-4 text-sm"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Where you are</p>
      <h2 className="mt-1 text-base font-medium">
        Search {searchPlaceLabel(profile)} · {pickupRadiusLabel(profile.maxDeadMiles)} ·
        Start {profile.startingCity} · Home {profile.homeCity}
      </h2>
      {compact ? null : (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Starting city is where the vehicle sits for costing. Refresh types the
          search place into Shiply Local — a postcode, not a city name.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            Shiply search — postcode or place
          </span>
          <input
            value={profile.searchLocation}
            onChange={(e) => setProfile({ ...profile, searchLocation: e.target.value })}
            placeholder="SE6"
            autoComplete="postal-code"
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50"
          />
          <span className="mt-1 block text-xs text-muted">
            Shiply Local pins one point. Typing London finds almost nothing. A
            postcode like SE6 plus 10 miles covers south-east London.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            Starting city — vehicle is here now
          </span>
          <select
            value={profile.startingCity}
            onChange={(e) => setProfile({ ...profile, startingCity: e.target.value })}
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50"
          >
            {CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-wider text-muted">
            Home city — where you finish the day
          </span>
          <select
            value={profile.homeCity}
            onChange={(e) => setProfile({ ...profile, homeCity: e.target.value })}
            className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50"
          >
            {CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-4">
        <PickupRadius
          value={profile.maxDeadMiles}
          onChange={(miles) => setProfile({ ...profile, maxDeadMiles: miles })}
        />
      </div>
      <p className="mt-3 text-xs text-muted">
        Change takes effect on the next rank. Fuel, vehicle and targets stay on{" "}
        <Link href="/profile#where-you-are" className="text-gold hover:underline">
          Vehicle & costs
        </Link>
        .
      </p>
    </div>
  );
}
