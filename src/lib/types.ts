export type VehicleType =
  | "van"
  | "luton"
  | "7.5t"
  | "18t"
  | "artic"
  | "car_transporter";

export type JobSource =
  | "Shiply"
  | "uShip"
  | "AnyVan"
  | "Clicktrans"
  | "Courier Exchange"
  | "Returnloads"
  | "Man and Van";

export type ScoreBand = "exceptional" | "strong" | "average" | "weak" | "poor";

export type CompetitionLevel = "low" | "medium" | "high";

export type ConfidenceLevel = "high" | "medium" | "low";

export type RouteSource = "osrm" | "estimate" | "mixed";

export type RouteLegKind = "deadhead" | "loaded" | "home";

export interface RouteLeg {
  kind: RouteLegKind;
  from: string;
  to: string;
  miles: number;
  minutes: number;
  source: "osrm" | "estimate";
}

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
  homeLocation: string;
  startingCity: string;
  searchLocation: string;
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
  highestBid?: number | null;
  weightKg: number | null;
  collectionWindow: string;
  deliveryWindow: string;
  postedMinutesAgo: number;
  quoteCount: number;
  description: string;
  loadingMinutesKnown: boolean;
  listingUrl?: string | null;
  listedMiles?: number | null;
}

export interface CostBreakdown {
  fuel: number;
  vehicle: number;
  deadMile: number;
  driverTime: number;
  fees: number;
  tolls: number;
  helper: number;
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
  deliveryToHomeMinutes: number;
  startToHomeMinutes: number;
  totalHours: number;
  legs: RouteLeg[];
  routeSource: RouteSource;
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
  suggestedQuote: number;
}

export type OutcomeKind = "quoted" | "won" | "lost" | "skipped";

export interface JobOutcome {
  id: string;
  jobId: string;
  kind: OutcomeKind;
  route: string;
  profit: number;
  revenue: number;
  at: string;
}

export type MovementKind =
  | "new"
  | "gone"
  | "bid_up"
  | "bid_down"
  | "quotes_up"
  | "new_leader"
  | "watched";

export interface MarketMovement {
  kind: MovementKind;
  jobId: string;
  label: string;
  detail: string;
  watched?: boolean;
}

export interface CombinationPlan {
  id: string;
  jobAId: string;
  jobBId: string;
  jobCId?: string;
  stops: 2 | 3;
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
  scanned: number;
  pickupRadiusMiles: number;
  startingCity: string;
  searchLocation: string;
  homeCity: string;
  homeLocation: string;
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
