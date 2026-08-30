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
  starting_city: string;
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
    startingCity: row.starting_city || DEFAULT_PROFILE.startingCity,
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

export function profileToRow(userId: string, profile: OperatorProfile) {
  return {
    id: userId,
    display_name: profile.displayName,
    home_city: profile.homeCity,
    starting_city: profile.startingCity,
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
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, home_city, starting_city, vehicle_type, payload_kg, mpg, fuel_price_per_litre, running_cost_per_mile, driver_hourly_cost, marketplace_fee_percent, target_profit_per_hour, min_profit, max_dead_miles, working_hours",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export async function upsertRemoteProfile(
  userId: string,
  profile: OperatorProfile,
): Promise<void> {
  const supabase = createBrowserSupabase();
  const { error } = await supabase
    .from("profiles")
    .upsert(profileToRow(userId, profile), { onConflict: "id" });
  if (error) throw error;
}
