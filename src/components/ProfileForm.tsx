"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { CITIES } from "@/lib/geo";
import { VEHICLE_LABELS } from "@/lib/profile";
import { useAppState } from "@/context/AppState";
import { PickupRadius } from "./WhereYouAre";
import { displayNameFromEmail } from "@/lib/auth";
import { useAuth } from "@/context/Auth";
import type { OperatorProfile, VehicleType } from "@/lib/types";

export function ProfileForm() {
  const { profile, setProfile, profileSave, market } = useAppState();
  const { user } = useAuth();

  const update = <K extends keyof OperatorProfile>(key: K, value: OperatorProfile[K]) => {
    setProfile({ ...profile, [key]: value });
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Your economics</p>
        <h1 className="mt-1 text-2xl font-medium">Vehicle & costs</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Every rank on this site is personal. Change fuel, home or starting
          city and the whole book is re-costed immediately — that is the
          product, not a prettier marketplace table.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4 text-sm">
        {user ? (
          <p className="mb-3">
            Welcome, <span className="text-gold">{displayNameFromEmail(user.email)}</span>
            .{" "}
            <span className="text-muted">
              {profileSave === "loading"
                ? "Loading your saved profile…"
                : profileSave === "saving"
                  ? "Saving to your account…"
                  : profileSave === "saved"
                    ? "This profile is saved to your account."
                    : profileSave === "error"
                      ? "Could not save to your account. Changes are still on this device."
                      : "Changes stay on this device until they save."}
            </span>
          </p>
        ) : (
          <p className="mb-3 text-muted">
            <Link href="/sign-in?next=/profile" className="text-gold hover:underline">
              Sign in
            </Link>{" "}
            to keep this profile with your account on every device.
          </p>
        )}
        After this profile, Best Overall is{" "}
        <span className="text-gold">
          {market.winners.bestOverall
            ? `${market.winners.bestOverall.pickupCity} → ${market.winners.bestOverall.deliveryCity}`
            : "—"}
        </span>{" "}
        at score {market.winners.bestOverall?.score ?? "—"}.
      </div>

      <form className="grid gap-4 md:grid-cols-2">
        <Field label="Display name">
          <input
            value={profile.displayName}
            onChange={(e) => update("displayName", e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Vehicle">
          <select
            value={profile.vehicleType}
            onChange={(e) => update("vehicleType", e.target.value as VehicleType)}
            className={inputClass}
          >
            {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <div id="where-you-are" className="grid gap-4 md:col-span-2 md:grid-cols-2">
        <Field label="Starting city — where the vehicle is now">
          <CitySelect
            value={profile.startingCity}
            onChange={(v) => update("startingCity", v)}
          />
        </Field>
        <Field label="Home city">
          <CitySelect value={profile.homeCity} onChange={(v) => update("homeCity", v)} />
        </Field>
        </div>
        <Field label="Payload (kg)">
          <input
            type="number"
            value={profile.payloadKg}
            onChange={(e) => update("payloadKg", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Fuel economy (MPG)">
          <input
            type="number"
            step="0.1"
            value={profile.mpg}
            onChange={(e) => update("mpg", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Fuel price (£ / litre)">
          <input
            type="number"
            step="0.01"
            value={profile.fuelPricePerLitre}
            onChange={(e) => update("fuelPricePerLitre", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Vehicle running cost (£ / mile, excluding fuel)">
          <input
            type="number"
            step="0.01"
            value={profile.runningCostPerMile}
            onChange={(e) => update("runningCostPerMile", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Driver time cost (£ / hour)">
          <input
            type="number"
            step="0.5"
            value={profile.driverHourlyCost}
            onChange={(e) => update("driverHourlyCost", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Marketplace fee (%)">
          <input
            type="number"
            step="0.1"
            value={profile.marketplaceFeePercent}
            onChange={(e) => update("marketplaceFeePercent", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Target £ / hour">
          <input
            type="number"
            value={profile.targetProfitPerHour}
            onChange={(e) => update("targetProfitPerHour", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <Field label="Minimum profit (£)">
          <input
            type="number"
            value={profile.minProfit}
            onChange={(e) => update("minProfit", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
        <div className="md:col-span-2">
          <PickupRadius
            value={profile.maxDeadMiles}
            onChange={(miles) => update("maxDeadMiles", miles)}
          />
        </div>
        <Field label="Working hours available today">
          <input
            type="number"
            step="0.5"
            value={profile.workingHours}
            onChange={(e) => update("workingHours", Number(e.target.value))}
            className={inputClass}
          />
        </Field>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function CitySelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {CITIES.map((city) => (
        <option key={city.name} value={city.name}>
          {city.name}
        </option>
      ))}
    </select>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50";
