"use client";

import Link from "next/link";
import { CITIES } from "@/lib/geo";
import {
  PICKUP_RADIUS_OPTIONS,
  homePlaceLabel,
  pickupRadiusLabel,
  searchPlaceLabel,
} from "@/lib/format";
import { useAppState } from "@/context/AppState";
import { PostcodeLocationField } from "./PostcodeLocationField";
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
      <span className="mb-1.5 block text-sm uppercase tracking-wider text-muted md:text-xs">
        How far you will go for a collection
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
                "min-h-11 rounded-md px-3 py-2 text-base md:min-h-0 md:px-2.5 md:py-1.5 md:text-sm",
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
      <p className="text-sm uppercase tracking-[0.22em] text-gold md:text-xs">Where you are</p>
      <h2 className="mt-1 text-base font-medium break-words">
        Search {searchPlaceLabel(profile)} · {pickupRadiusLabel(profile.maxDeadMiles)} ·
        Start {profile.startingCity} · Home {homePlaceLabel(profile)}
      </h2>
      {compact ? null : (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Start and home postcodes are for costing. Refresh uses the start
          postcode to find jobs around you.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PostcodeLocationField
            label="Where you are now — postcode"
            hint="Enter this to find more listings around you. A postcode such as SE6 is also your starting location. A city name like London finds almost nothing."
            locate
            value={profile.searchLocation}
            onChange={(next) =>
              setProfile({
                ...profile,
                searchLocation: next.postcode,
                startingCity: next.city ?? profile.startingCity,
              })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <PostcodeLocationField
            label="Home — postcode"
            hint="Where you finish the day. We use this to cost the run home."
            value={profile.homeLocation}
            onChange={(next) =>
              setProfile({
                ...profile,
                homeLocation: next.postcode,
                homeCity: next.city ?? profile.homeCity,
              })
            }
          />
        </div>
        <label className="block">
          <span className="mb-1 block text-sm uppercase tracking-wider text-muted md:text-xs">
            Where you are now — nearest city
          </span>
          <select
            value={profile.startingCity}
            onChange={(e) => setProfile({ ...profile, startingCity: e.target.value })}
            className="min-h-11 w-full rounded-md border border-line bg-ink px-3 py-2 text-base outline-none focus:border-gold/50 md:text-sm"
          >
            {CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm uppercase tracking-wider text-muted md:text-xs">
            Home — nearest city
          </span>
          <select
            value={profile.homeCity}
            onChange={(e) => setProfile({ ...profile, homeCity: e.target.value })}
            className="min-h-11 w-full rounded-md border border-line bg-ink px-3 py-2 text-base outline-none focus:border-gold/50 md:text-sm"
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
      <p className="mt-3 text-sm text-muted md:text-xs">
        A new Shiply refresh uses this postcode and radius. Fuel, vehicle and
        profit targets are on{" "}
        <Link href="/profile" className="text-gold hover:underline">
          Costs
        </Link>
        .
      </p>
    </div>
  );
}
