import { headingDelta, roadMiles, roadMinutes, routePairSource } from "./geo";
import { vehicleCompatible } from "./profile";
import type {
  CostBreakdown,
  OperatorProfile,
  RawJob,
  RouteLeg,
  RouteSource,
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

function driveLeg(
  kind: RouteLeg["kind"],
  from: string,
  to: string,
): RouteLeg {
  return {
    kind,
    from,
    to,
    miles: roadMiles(from, to),
    minutes: roadMinutes(from, to),
    source: routePairSource(from, to),
  };
}

export type JobScenario = {
  quote?: number;
  fuelPricePerLitre?: number;
  extraTolls?: number;
  helperCost?: number;
  waitingMinutes?: number;
  startingCity?: string;
};

export const TARGET_MARGIN = 0.32;

export function costJob(
  job: RawJob,
  profile: OperatorProfile,
  scenario: JobScenario = {},
) {
  const start = scenario.startingCity || profile.startingCity;
  const priced: OperatorProfile = {
    ...profile,
    startingCity: start,
    fuelPricePerLitre: scenario.fuelPricePerLitre ?? profile.fuelPricePerLitre,
  };
  const quote = scenario.quote && scenario.quote > 0 ? scenario.quote : job.revenue;
  const deadhead = driveLeg("deadhead", start, job.pickupCity);
  const loaded = driveLeg("loaded", job.pickupCity, job.deliveryCity);
  const home = driveLeg("home", job.deliveryCity, profile.homeCity);
  const legs = [deadhead, loaded, home];
  const routeSource: RouteSource = legs.every((leg) => leg.source === "osrm")
    ? "osrm"
    : legs.every((leg) => leg.source === "estimate")
      ? "estimate"
      : "mixed";

  const pickupMiles = deadhead.miles;
  const loadedMiles = loaded.miles;
  const deliveryToHomeMiles = home.miles;
  const startToHomeMiles = roadMiles(start, profile.homeCity);
  const deadMiles = pickupMiles;
  const totalMiles = pickupMiles + loadedMiles;
  const pickupMinutes = deadhead.minutes;
  const loadedMinutes = loaded.minutes;
  const deliveryToHomeMinutes = home.minutes;
  const startToHomeMinutes = roadMinutes(start, profile.homeCity);
  const handling = (job.loadingMinutesKnown ? LOADING_MINUTES : 55) + UNLOADING_MINUTES;
  const waitingMinutes = Math.max(0, scenario.waitingMinutes ?? 0);
  const totalHours = (pickupMinutes + loadedMinutes + handling + waitingMinutes) / 60;

  const fuelPerMile = fuelPencePerMile(priced);
  const fuel = totalMiles * fuelPerMile;
  const vehicle = totalMiles * priced.runningCostPerMile;
  const deadMile = deadMiles * (fuelPerMile + priced.runningCostPerMile);
  const driverTime = totalHours * priced.driverHourlyCost;
  const fees = quote * (priced.marketplaceFeePercent / 100);
  const tolls = estimateTolls(loadedMiles, job.pickupCity, job.deliveryCity) + Math.max(0, scenario.extraTolls ?? 0);
  const helper = Math.max(0, scenario.helperCost ?? 0);

  const costs: CostBreakdown = {
    fuel: round2(fuel),
    vehicle: round2(vehicle),
    deadMile: round2(deadMile),
    driverTime: round2(driverTime),
    fees: round2(fees),
    tolls: round2(tolls),
    helper: round2(helper),
    total: 0,
  };
  costs.total = round2(
    costs.fuel + costs.vehicle + costs.driverTime + costs.fees + costs.tolls + costs.helper,
  );

  const profit = round2(quote - costs.total);
  const profitPerHour = totalHours > 0 ? round2(profit / totalHours) : 0;
  const profitPerMile = totalMiles > 0 ? round2(profit / totalMiles) : 0;
  const margin = quote > 0 ? profit / quote : 0;
  const towardsHomeMiles = startToHomeMiles - deliveryToHomeMiles;

  const vehicleFit = vehicleCompatible(job.vehicleRequired, profile.vehicleType)
    ? job.vehicleRequired === profile.vehicleType
      ? 10
      : 8
    : 2;

  const scheduleFit = totalHours <= profile.workingHours ? 5 : 2;
  const routeFit = routeFitScore(
    start,
    profile.homeCity,
    job.pickupCity,
    job.deliveryCity,
    towardsHomeMiles,
    deadMiles,
    loadedMiles,
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
    deliveryToHomeMinutes,
    startToHomeMinutes,
    totalHours: round2(totalHours),
    legs,
    routeSource,
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
  loadedMiles: number,
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

  const deadRatio = loadedMiles > 0 ? deadMiles / loadedMiles : 1;
  if (deadRatio <= 0.15) score += 1;
  else if (deadRatio > 0.85) score -= 1;

  if (start !== home && start !== delivery) {
    const alignment = headingDelta(start, delivery, start, home);
    if (alignment <= 35) score += 2;
    else if (alignment <= 70) score += 1;
    else if (alignment >= 120) score -= 1;
  }

  return clamp(score, 1, 10);
}

export function fulfilmentCost(costs: CostBreakdown): number {
  return round2(costs.total - costs.fees);
}

export function breakEvenQuote(fulfilment: number, feePercent: number): number {
  const fee = Math.min(0.4, Math.max(0, feePercent / 100));
  return Math.ceil(fulfilment / Math.max(0.5, 1 - fee));
}

export function profitAtQuote(
  fulfilment: number,
  hours: number,
  miles: number,
  quote: number,
  feePercent: number,
) {
  const fees = quote * (feePercent / 100);
  const profit = quote - fulfilment - fees;
  return {
    revenue: quote,
    profit: round2(profit),
    profitPerHour: hours > 0 ? round2(profit / hours) : 0,
    profitPerMile: miles > 0 ? round2(profit / miles) : 0,
    margin: quote > 0 ? profit / quote : 0,
  };
}

export function suggestedQuoteFor(job: RawJob, profile: OperatorProfile): number {
  const economics = costJob(job, profile, { quote: 1 });
  return recommendedQuote(fulfilmentCost(economics.costs), economics.totalHours, profile);
}

export function recommendedQuote(
  fulfilment: number,
  hours: number,
  profile: OperatorProfile,
): number {
  const fee = Math.min(0.4, Math.max(0, profile.marketplaceFeePercent / 100));
  const needProfit = Math.max(profile.minProfit, profile.targetProfitPerHour * hours);
  const forProfit = (fulfilment + needProfit) / Math.max(0.5, 1 - fee);
  const marginDenom = 1 - fee - TARGET_MARGIN;
  const forMargin = marginDenom > 0.08 ? fulfilment / marginDenom : forProfit;
  return Math.ceil(Math.max(forProfit, forMargin) / 5) * 5;
}

export function quoteLadder(fulfilment: number, feePercent: number, steps = 5): number[] {
  const start = Math.ceil(breakEvenQuote(fulfilment, feePercent) / 50) * 50;
  return Array.from({ length: steps }, (_, i) => start + i * 50);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
