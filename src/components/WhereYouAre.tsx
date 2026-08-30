"use client";

import Link from "next/link";
import { CITIES } from "@/lib/geo";
import { useAppState } from "@/context/AppState";

export function WhereYouAre({ compact = false }: { compact?: boolean }) {
  const { profile, setProfile } = useAppState();

  return (
    <div
      id="where-you-are"
      className="rounded-lg border border-gold/25 bg-panel p-4 text-sm"
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Where you are</p>
      <h2 className="mt-1 text-base font-medium">
        Starting {profile.startingCity} · Home {profile.homeCity}
      </h2>
      {compact ? null : (
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Dead miles are from where the vehicle is now. After delivery we
          measure the run home. If these cities are wrong, the Shiply winners
          are wrong.
        </p>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
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
