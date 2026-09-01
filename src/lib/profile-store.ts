import { createBrowserSupabase } from "@/lib/supabase-browser";
import { DEFAULT_PROFILE } from "@/lib/profile";
import type { OperatorProfile, VehicleType } from "@/lib/types";

const VEHICLES = new Set<VehicleType>([
  "van",
  "luton",
  "7.5t",
  "18t",
  "artic",
  "car_transporter",
]);

interface ProfileRow {
  id: string;
  display_name: string;
  home_city: string;
  home_location?: string | null;
  starting_city: string;
  search_location?: string | null;
  vehicle_type: string;
  payload_kg: number | string;
  mpg: number | string;
  fuel_price_per_litre: number | string;
  running_cost_per_mile: number | string;
  driver_hourly_cost: number | string;
  marketplace_fee_percent: number | string;
  target_profit_per_hour: number | string;
  min_profit: number | string;
  max_dead_miles: number | string;
  working_hours: number | string;
}

function num(value: number | string | null | undefined, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function vehicle(value: string | null | undefined): VehicleType {
  return value && VEHICLES.has(value as VehicleType)
    ? (value as VehicleType)
    : DEFAULT_PROFILE.vehicleType;
}

export function rowToProfile(row: ProfileRow): OperatorProfile {
  return {
    displayName: row.display_name || DEFAULT_PROFILE.displayName,
    homeCity: row.home_city || DEFAULT_PROFILE.homeCity,
    homeLocation: row.home_location?.trim() || DEFAULT_PROFILE.homeLocation,
    startingCity: row.starting_city || DEFAULT_PROFILE.startingCity,
    searchLocation: row.search_location?.trim() || DEFAULT_PROFILE.searchLocation,
    vehicleType: vehicle(row.vehicle_type),
    payloadKg: num(row.payload_kg, DEFAULT_PROFILE.payloadKg),
    mpg: num(row.mpg, DEFAULT_PROFILE.mpg),
    fuelPricePerLitre: num(row.fuel_price_per_litre, DEFAULT_PROFILE.fuelPricePerLitre),
    runningCostPerMile: num(row.running_cost_per_mile, DEFAULT_PROFILE.runningCostPerMile),
    driverHourlyCost: num(row.driver_hourly_cost, DEFAULT_PROFILE.driverHourlyCost),
    marketplaceFeePercent: num(
      row.marketplace_fee_percent,
      DEFAULT_PROFILE.marketplaceFeePercent,
    ),
    targetProfitPerHour: num(
      row.target_profit_per_hour,
      DEFAULT_PROFILE.targetProfitPerHour,
    ),
    minProfit: num(row.min_profit, DEFAULT_PROFILE.minProfit),
    maxDeadMiles: num(row.max_dead_miles, DEFAULT_PROFILE.maxDeadMiles),
    workingHours: num(row.working_hours, DEFAULT_PROFILE.workingHours),
  };
}

export function profileToRow(
  userId: string,
  profile: OperatorProfile,
  email?: string | null,
) {
  return {
    id: userId,
    email: email?.trim().toLowerCase() || null,
    display_name: profile.displayName,
    home_city: profile.homeCity,
    home_location: profile.homeLocation.trim(),
    starting_city: profile.startingCity,
    search_location: profile.searchLocation.trim(),
    vehicle_type: profile.vehicleType,
    payload_kg: profile.payloadKg,
    mpg: profile.mpg,
    fuel_price_per_litre: profile.fuelPricePerLitre,
    running_cost_per_mile: profile.runningCostPerMile,
    driver_hourly_cost: profile.driverHourlyCost,
    marketplace_fee_percent: profile.marketplaceFeePercent,
    target_profit_per_hour: profile.targetProfitPerHour,
    min_profit: profile.minProfit,
    max_dead_miles: profile.maxDeadMiles,
    working_hours: profile.workingHours,
  };
}

export async function fetchRemoteProfile(
  userId: string,
): Promise<OperatorProfile | null> {
  const supabase = createBrowserSupabase();
  const columns =
    "id, display_name, home_city, home_location, starting_city, search_location, vehicle_type, payload_kg, mpg, fuel_price_per_litre, running_cost_per_mile, driver_hourly_cost, marketplace_fee_percent, target_profit_per_hour, min_profit, max_dead_miles, working_hours";
  let select = columns;
  for (;;) {
    const first = await supabase.from("profiles").select(select).eq("id", userId).maybeSingle();
    if (!first.error) {
      return first.data ? rowToProfile(first.data as unknown as ProfileRow) : null;
    }
    if (/home_location/i.test(first.error.message) && select.includes("home_location")) {
      select = select.replace(", home_location", "");
      continue;
    }
    if (/search_location/i.test(first.error.message) && select.includes("search_location")) {
      select = select.replace(", search_location", "");
      continue;
    }
    throw first.error;
  }
}

export async function upsertRemoteProfile(
  userId: string,
  profile: OperatorProfile,
  email?: string | null,
): Promise<void> {
  const supabase = createBrowserSupabase();
  const row = profileToRow(userId, profile, email);
  const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
  if (error && /email/i.test(error.message) && "email" in row) {
    const { email: _dropped, ...withoutEmail } = row;
    const retry = await supabase.from("profiles").upsert(withoutEmail, { onConflict: "id" });
    if (retry.error) throw retry.error;
    return;
  }
  if (error && /home_location|search_location/i.test(error.message)) {
    let next: Record<string, unknown> = { ...row };
    if (/home_location/i.test(error.message)) {
      const { home_location: _dropped, ...rest } = next;
      next = rest;
    }
    if (/search_location/i.test(error.message)) {
      const { search_location: _dropped, ...rest } = next;
      next = rest;
    }
    const retry = await supabase.from("profiles").upsert(next, { onConflict: "id" });
    if (retry.error && /home_location|search_location/i.test(retry.error.message)) {
      const { home_location: _h, search_location: _s, ...rest } = next;
      const again = await supabase.from("profiles").upsert(rest, { onConflict: "id" });
      if (again.error) throw again.error;
      return;
    }
    if (retry.error) throw retry.error;
    return;
  }
  if (error) throw error;
}
