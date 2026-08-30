import type { OperatorProfile, VehicleType } from "./types";

export const DEFAULT_PROFILE: OperatorProfile = {
  displayName: "Owner-driver",
  homeCity: "Birmingham",
  startingCity: "Manchester",
  searchLocation: "",
  vehicleType: "7.5t",
  payloadKg: 3500,
  mpg: 14,
  fuelPricePerLitre: 1.49,
  runningCostPerMile: 0.28,
  driverHourlyCost: 18,
  marketplaceFeePercent: 3.5,
  targetProfitPerHour: 55,
  minProfit: 250,
  maxDeadMiles: 40,
  workingHours: 10,
};

export const VEHICLE_LABELS: Record<VehicleType, string> = {
  van: "Large van",
  luton: "Luton",
  "7.5t": "7.5 tonne",
  "18t": "18 tonne",
  artic: "Artic",
  car_transporter: "Car transporter",
};

const STORAGE_KEY = "tc-profile-v1";

export function loadProfile(): OperatorProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(profile: OperatorProfile): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function vehicleCompatible(
  required: VehicleType,
  have: VehicleType,
): boolean {
  const rank: Record<VehicleType, number> = {
    van: 1,
    luton: 2,
    "7.5t": 3,
    "18t": 4,
    artic: 5,
    car_transporter: 3,
  };
  if (required === "car_transporter" || have === "car_transporter") {
    return required === have;
  }
  return rank[have] >= rank[required];
}
