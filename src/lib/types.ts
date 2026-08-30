export type VehicleType =
  | "van"
  | "luton"
  | "7.5t"
  | "18t"
  | "artic"
  | "car_transporter";

export type JobSource = "Shiply" | "uShip" | "Courier Exchange" | "Returnloads";

export type ScoreBand = "exceptional" | "strong" | "average" | "weak" | "poor";

export type CompetitionLevel = "low" | "medium" | "high";

export type ConfidenceLevel = "high" | "medium" | "low";

export type WinnerKind =
  | "best_overall"
  | "highest_profit"
  | "best_per_hour"
  | "lowest_dead"
  | "towards_home"
  | "best_combination";

export interface City {
  name: string;
  lat: number;
  lng: number;
  region: string;
}

export interface OperatorProfile {
  displayName: string;
  homeCity: string;
  startingCity: string;
  vehicleType: VehicleType;
  payloadKg: number;
  mpg: number;
  fuelPricePerLitre: number;
  runningCostPerMile: number;
  driverHourlyCost: number;
  marketplaceFeePercent: number;
  targetProfitPerHour: number;
  minProfit: number;
  maxDeadMiles: number;
  workingHours: number;
}

export interface RawJob {
  id: string;
  source: JobSource;
  pickupCity: string;
  deliveryCity: string;
  category: string;
  vehicleRequired: VehicleType;
  revenue: number;
  weightKg: number | null;
  collectionWindow: string;
  deliveryWindow: string;
  postedMinutesAgo: number;
  quoteCount: number;
  description: string;
  loadingMinutesKnown: boolean;
}

export interface CostBreakdown {
  fuel: number;
  vehicle: number;
  deadMile: number;
  driverTime: number;
  fees: number;
  tolls: number;
  total: number;
}

export interface ScoreFactor {
  key: string;
  label: string;
  score: number;
  max: number;
  note: string;
}

export interface Flag {
  kind: "strength" | "risk";
  label: string;
}

export interface OnwardIntel {
  jobsWithin25: number;
  strongOrBetter: number;
  exceptional: number;
  averagePickupMiles: number;
  bestOnwardProfit: number;
  rating: "excellent" | "good" | "average" | "poor";
}

export interface Percentiles {
  profit: number;
  profitPerHour: number;
  deadMiles: number;
  routeFit: number;
  personalScore: number;
}

export interface AnalysedJob extends RawJob {
  pickupMiles: number;
  loadedMiles: number;
  deliveryToHomeMiles: number;
  startToHomeMiles: number;
  towardsHomeMiles: number;
  deadMiles: number;
  totalMiles: number;
  loadedMinutes: number;
  pickupMinutes: number;
  totalHours: number;
  costs: CostBreakdown;
  profit: number;
  profitPerHour: number;
  profitPerMile: number;
  margin: number;
  routeFit: number;
  vehicleFit: number;
  scheduleFit: number;
  competition: CompetitionLevel;
  onward: OnwardIntel;
  marketScore: number;
  personalScore: number;
  score: number;
  band: ScoreBand;
  factors: ScoreFactor[];
  flags: Flag[];
  percentiles: Percentiles;
  confidence: ConfidenceLevel;
  winnerLabels: WinnerKind[];
  vsTodayProfitPct: number;
  vsTargetHour: number;
  vsMinProfit: number;
}

export interface CombinationPlan {
  id: string;
  jobAId: string;
  jobBId: string;
  label: string;
  gapMiles: number;
  revenue: number;
  costs: number;
  profit: number;
  hours: number;
  profitPerHour: number;
  deadMiles: number;
  finishCity: string;
  finishToHomeMiles: number;
  score: number;
}

export interface MarketSummary {
  analysed: number;
  startingCity: string;
  homeCity: string;
  quality: number;
  qualityLabel: string;
  bands: Record<ScoreBand, number>;
  bestProfit: number;
  bestPerHour: number;
  medianProfit: number;
  medianPerHour: number;
  strongestDestination: string;
}

export interface Winners {
  bestOverall: AnalysedJob | null;
  highestProfit: AnalysedJob | null;
  bestPerHour: AnalysedJob | null;
  lowestDead: AnalysedJob | null;
  towardsHome: AnalysedJob | null;
  bestCombination: CombinationPlan | null;
}

export interface AnalysedMarket {
  jobs: AnalysedJob[];
  winners: Winners;
  combinations: CombinationPlan[];
  market: MarketSummary;
  actNow: AnalysedJob[];
  consider: AnalysedJob[];
  monitor: AnalysedJob[];
  ignoreCount: number;
}
