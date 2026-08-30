import { roadMiles, roadMinutes } from "./geo";
import { vehicleCompatible } from "./profile";
import type {
  AnalysedJob,
  CostBreakdown,
  OperatorProfile,
  RawJob,
} from "./types";

const LITRES_PER_UK_GALLON = 4.54609;
const LOADING_MINUTES = 50;
const UNLOADING_MINUTES = 45;

export function fuelPencePerMile(profile: OperatorProfile): number {
  const litresPerMile = LITRES_PER_UK_GALLON / profile.mpg;
  return litresPerMile * profile.fuelPricePerLitre;
}

export function estimateTolls(loadedMiles: number, pickup: string, delivery: string): number {
  const corridor = `${pickup} ${delivery}`;
  let tolls = 0;
  if (loadedMiles > 160) tolls += 11;
  if (/London|Reading|Oxford/.test(corridor)) tolls += 6;
  if (/Manchester|Birmingham|Leeds/.test(corridor) && loadedMiles > 90) tolls += 4;
  return tolls;
}

export function costJob(job: RawJob, profile: OperatorProfile) {
  const pickupMiles = roadMiles(profile.startingCity, job.pickupCity);
  const loadedMiles = roadMiles(job.pickupCity, job.deliveryCity);
  const deliveryToHomeMiles = roadMiles(job.deliveryCity, profile.homeCity);
  const startToHomeMiles = roadMiles(profile.startingCity, profile.homeCity);
  const deadMiles = pickupMiles;
  const totalMiles = pickupMiles + loadedMiles;
  const pickupMinutes = roadMinutes(pickupMiles);
  const loadedMinutes = roadMinutes(loadedMiles);
  const handling = (job.loadingMinutesKnown ? LOADING_MINUTES : 55) + UNLOADING_MINUTES;
  const totalHours = (pickupMinutes + loadedMinutes + handling) / 60;

  const fuelPerMile = fuelPencePerMile(profile);
  const fuel = totalMiles * fuelPerMile;
  const vehicle = totalMiles * profile.runningCostPerMile;
  const deadMile = deadMiles * (fuelPerMile + profile.runningCostPerMile);
  const driverTime = totalHours * profile.driverHourlyCost;
  const fees = job.revenue * (profile.marketplaceFeePercent / 100);
  const tolls = estimateTolls(loadedMiles, job.pickupCity, job.deliveryCity);

  const costs: CostBreakdown = {
    fuel: round2(fuel),
    vehicle: round2(vehicle),
    deadMile: round2(deadMile),
    driverTime: round2(driverTime),
    fees: round2(fees),
    tolls,
    total: 0,
  };
  costs.total = round2(
    costs.fuel + costs.vehicle + costs.driverTime + costs.fees + costs.tolls,
  );

  const profit = round2(job.revenue - costs.total);
  const profitPerHour = totalHours > 0 ? round2(profit / totalHours) : 0;
  const profitPerMile = totalMiles > 0 ? round2(profit / totalMiles) : 0;
  const margin = job.revenue > 0 ? profit / job.revenue : 0;
  const towardsHomeMiles = startToHomeMiles - deliveryToHomeMiles;

  const vehicleFit = vehicleCompatible(job.vehicleRequired, profile.vehicleType)
    ? job.vehicleRequired === profile.vehicleType
      ? 10
      : 8
    : 2;

  const scheduleFit = totalHours <= profile.workingHours ? 5 : 2;
  const routeFit = routeFitScore(
    profile.startingCity,
    profile.homeCity,
    job.pickupCity,
    job.deliveryCity,
    towardsHomeMiles,
    deadMiles,
  );

  return {
    pickupMiles,
    loadedMiles,
    deliveryToHomeMiles,
    startToHomeMiles,
    towardsHomeMiles,
    deadMiles,
    totalMiles,
    loadedMinutes,
    pickupMinutes,
    totalHours: round2(totalHours),
    costs,
    profit,
    profitPerHour,
    profitPerMile,
    margin,
    vehicleFit,
    scheduleFit,
    routeFit,
  };
}

function routeFitScore(
  start: string,
  home: string,
  pickup: string,
  delivery: string,
  towardsHome: number,
  deadMiles: number,
): number {
  let score = 6;
  if (deadMiles <= 12) score += 2;
  else if (deadMiles <= 25) score += 1;
  else if (deadMiles > 70) score -= 3;
  else if (deadMiles > 40) score -= 1;
  if (towardsHome >= 40) score += 2;
  else if (towardsHome >= 10) score += 1;
  else if (towardsHome < -80) score -= 2;
  if (pickup === start) score += 1;
  if (delivery === home) score += 1;
  return clamp(score, 1, 10);
}

export function breakEvenQuote(job: Pick<AnalysedJob, "costs">): number {
  return Math.ceil(job.costs.total);
}

export function profitAtQuote(
  job: Pick<AnalysedJob, "costs" | "totalHours" | "totalMiles">,
  quote: number,
  feePercent: number,
) {
  const fees = quote * (feePercent / 100);
  const total = job.costs.fuel + job.costs.vehicle + job.costs.driverTime + fees + job.costs.tolls;
  const profit = quote - total;
  return {
    revenue: quote,
    profit: round2(profit),
    profitPerHour: job.totalHours > 0 ? round2(profit / job.totalHours) : 0,
    profitPerMile: job.totalMiles > 0 ? round2(profit / job.totalMiles) : 0,
    margin: quote > 0 ? profit / quote : 0,
  };
}

export function recommendedQuote(
  job: AnalysedJob,
  profile: OperatorProfile,
): number {
  const needed =
    job.costs.total +
    Math.max(profile.minProfit, profile.targetProfitPerHour * job.totalHours);
  return Math.ceil(needed / 5) * 5;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
