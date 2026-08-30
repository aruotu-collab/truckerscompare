import { costJob, fulfilmentCost, suggestedQuoteFor, type JobScenario } from "./costs";
import { generateDemoJobs } from "./demo-jobs";
import { roadMiles, roadMinutes } from "./geo";
import type {
  AnalysedJob,
  AnalysedMarket,
  CombinationPlan,
  ConfidenceLevel,
  Flag,
  MarketSummary,
  OnwardIntel,
  OperatorProfile,
  Percentiles,
  RawJob,
  ScoreBand,
  ScoreFactor,
  Winners,
} from "./types";

const RAW_JOBS = generateDemoJobs();

export function getRawJobs(): RawJob[] {
  return RAW_JOBS;
}

export function analyseMarket(
  profile: OperatorProfile,
  rawJobs: RawJob[] = RAW_JOBS,
  options: { applyPickupRadius?: boolean } = {},
): AnalysedMarket {
  const book = rawJobs.length > 0 ? rawJobs : RAW_JOBS;
  const costed = book.map((job) => {
    const suggestedQuote = suggestedQuoteFor(job, profile);
    const quote = job.revenue > 0 ? job.revenue : suggestedQuote;
    return {
      job,
      suggestedQuote,
      economics: costJob(job, profile, { quote }),
    };
  });
  const radius = profile.maxDeadMiles;
  const scoped =
    options.applyPickupRadius !== false && radius > 0
      ? costed.filter((row) => row.economics.pickupMiles <= radius)
      : costed;

  const onwardByCity = buildOnward(scoped);

  const profits = scoped.map((c) => c.economics.profit);
  const perHours = scoped.map((c) => c.economics.profitPerHour);
  const deads = scoped.map((c) => c.economics.deadMiles);
  const routes = scoped.map((c) => c.economics.routeFit);

  const jobs: AnalysedJob[] = scoped.map(({ job, economics, suggestedQuote }) => {
    const onward = onwardByCity.get(job.deliveryCity) ?? emptyOnward();
    const competition = competitionLevel(job.quoteCount, job.postedMinutesAgo);
    const confidence = confidenceOf(job);

    const marketScore = marketScoreOf(economics, profits, perHours, deads, routes);
    const { personalScore, factors } = personalScoreOf(
      job,
      economics,
      profile,
      onward,
      competition,
    );
    const score = Math.round(marketScore * 0.42 + personalScore * 0.58);
    const band = bandOf(score);
    const flags = flagsOf(job, economics, profile, onward, competition, band);

    return {
      ...job,
      ...economics,
      onward,
      competition,
      marketScore,
      personalScore,
      score,
      band,
      factors,
      flags,
      percentiles: emptyPercentiles(),
      confidence,
      winnerLabels: [],
      vsTodayProfitPct: 0,
      vsTargetHour: economics.profitPerHour - profile.targetProfitPerHour,
      vsMinProfit: economics.profit - profile.minProfit,
      suggestedQuote,
    };
  });

  attachPercentiles(jobs);
  for (const j of jobs) {
    const med = median(jobs.map((x) => x.profit));
    j.vsTodayProfitPct = med === 0 ? 0 : ((j.profit - med) / Math.abs(med)) * 100;
  }

  const combinations = findCombinations(jobs, profile);
  const winners = pickWinners(jobs, combinations);
  applyWinnerLabels(jobs, winners);

  jobs.sort((a, b) => b.score - a.score || b.profit - a.profit);

  const actNow = jobs.filter((j) => j.score >= 88).slice(0, 3);
  const consider = jobs.filter((j) => j.score >= 78 && j.score < 88).slice(0, 5);
  const monitor = jobs.filter((j) => j.score >= 70 && j.score < 78).slice(0, 4);
  const used = new Set(
    [...actNow, ...consider, ...monitor].map((j) => j.id),
  );

  return {
    jobs,
    winners,
    combinations,
    market: summarise(jobs, profile, costed.length),
    actNow,
    consider,
    monitor,
    ignoreCount: jobs.length - used.size,
  };
}

function buildOnward(
  costed: { job: RawJob; economics: ReturnType<typeof costJob> }[],
): Map<string, OnwardIntel> {
  const map = new Map<string, OnwardIntel>();
  const cities = [...new Set(costed.map((c) => c.job.deliveryCity))];

  for (const dest of cities) {
    const nearby = costed.filter((c) => {
      if (c.job.pickupCity === dest) return true;
      return roadMiles(dest, c.job.pickupCity) <= 25;
    });
    const strong = nearby.filter((c) => c.economics.profit >= 280);
    const exceptional = nearby.filter((c) => c.economics.profit >= 420);
    const avgPickup =
      nearby.length === 0
        ? 30
        : nearby.reduce((s, c) => s + roadMiles(dest, c.job.pickupCity), 0) /
          nearby.length;
    const best = nearby.reduce((m, c) => Math.max(m, c.economics.profit), 0);

    let rating: OnwardIntel["rating"] = "poor";
    if (exceptional.length >= 2 && nearby.length >= 8) rating = "excellent";
    else if (strong.length >= 3 || nearby.length >= 10) rating = "good";
    else if (nearby.length >= 4) rating = "average";

    map.set(dest, {
      jobsWithin25: nearby.length,
      strongOrBetter: strong.length,
      exceptional: exceptional.length,
      averagePickupMiles: Math.round(avgPickup),
      bestOnwardProfit: Math.round(best),
      rating,
    });
  }
  return map;
}

function emptyOnward(): OnwardIntel {
  return {
    jobsWithin25: 0,
    strongOrBetter: 0,
    exceptional: 0,
    averagePickupMiles: 30,
    bestOnwardProfit: 0,
    rating: "poor",
  };
}

function marketScoreOf(
  economics: ReturnType<typeof costJob>,
  profits: number[],
  perHours: number[],
  deads: number[],
  routes: number[],
): number {
  const profitPts = percentile(economics.profit, profits) * 0.38;
  const hourPts = percentile(economics.profitPerHour, perHours) * 0.32;
  const deadPts = (100 - percentile(economics.deadMiles, deads)) * 0.18;
  const routePts = percentile(economics.routeFit, routes) * 0.12;
  return clamp(Math.round(profitPts + hourPts + deadPts + routePts), 1, 99);
}

function personalScoreOf(
  job: RawJob,
  economics: ReturnType<typeof costJob>,
  profile: OperatorProfile,
  onward: OnwardIntel,
  competition: AnalysedJob["competition"],
): { personalScore: number; factors: ScoreFactor[] } {
  const profit = clamp(scale(economics.profit, 80, 620) * 25, 0, 25);
  const perHour = clamp(scale(economics.profitPerHour, 18, 85) * 20, 0, 20);
  const dead = clamp((1 - scale(economics.deadMiles, 4, 90)) * 15, 0, 15);
  const route = economics.routeFit;
  const vehicle = economics.vehicleFit;
  const schedule = economics.scheduleFit;
  const comp = competition === "low" ? 5 : competition === "medium" ? 3 : 1;
  const onwardPts =
    onward.rating === "excellent" ? 5 : onward.rating === "good" ? 4 : onward.rating === "average" ? 2 : 1;
  const pref =
    economics.profitPerHour >= profile.targetProfitPerHour
      ? 4
      : economics.profitPerHour >= profile.targetProfitPerHour - 10
        ? 2
        : 0;
  const homeBonus = economics.towardsHomeMiles >= 30 ? 1 : 0;

  const factors: ScoreFactor[] = [
    {
      key: "profit",
      label: "Estimated profit",
      score: round1(profit),
      max: 25,
      note: "Cash left after fuel, running, time, fees and tolls",
    },
    {
      key: "perHour",
      label: "Profit per hour",
      score: round1(perHour),
      max: 20,
      note: "How hard this job pays your working day",
    },
    {
      key: "dead",
      label: "Dead-mile efficiency",
      score: round1(dead),
      max: 15,
      note: "Empty running from your current position to collection",
    },
    {
      key: "route",
      label: "Route fit",
      score: route,
      max: 10,
      note: "Road direction versus home, deadhead ratio and current starting point",
    },
    {
      key: "vehicle",
      label: "Vehicle fit",
      score: vehicle,
      max: 10,
      note: "Whether your vehicle can legally and practically do the work",
    },
    {
      key: "schedule",
      label: "Schedule fit",
      score: schedule,
      max: 5,
      note: "Fits inside your working-hours cap",
    },
    {
      key: "competition",
      label: "Competition",
      score: comp,
      max: 5,
      note: "Quote activity and listing age — not a win probability",
    },
    {
      key: "onward",
      label: "Onward work",
      score: onwardPts,
      max: 5,
      note: "Quality of jobs near the destination after delivery",
    },
    {
      key: "preference",
      label: "Preference fit",
      score: pref + homeBonus,
      max: 5,
      note: "Your £/hour target and whether it moves you home",
    },
  ];

  const total = factors.reduce((s, f) => s + f.score, 0);
  const max = factors.reduce((s, f) => s + f.max, 0);
  const personalScore = clamp(Math.round((total / max) * 100), 1, 99);
  return { personalScore, factors };
}

function flagsOf(
  job: RawJob,
  economics: ReturnType<typeof costJob>,
  profile: OperatorProfile,
  onward: OnwardIntel,
  competition: AnalysedJob["competition"],
  band: ScoreBand,
): Flag[] {
  const flags: Flag[] = [];
  if (economics.profitPerHour >= 70) flags.push({ kind: "strength", label: "Top-tier £/hour" });
  if (economics.deadMiles <= 12) flags.push({ kind: "strength", label: "Very low dead miles" });
  if (economics.towardsHomeMiles >= 40)
    flags.push({ kind: "strength", label: "Takes you towards home" });
  if (onward.rating === "excellent")
    flags.push({ kind: "strength", label: "Strong onward market" });
  if (job.postedMinutesAgo <= 15) flags.push({ kind: "strength", label: "Newly posted" });
  if (competition === "low") flags.push({ kind: "strength", label: "Low competition" });
  if (economics.vehicleFit >= 8) flags.push({ kind: "strength", label: "Correct vehicle" });
  if (band === "exceptional") flags.push({ kind: "strength", label: "Exceptional book quality" });

  if (economics.deadMiles >= 55) flags.push({ kind: "risk", label: `${Math.round(economics.deadMiles)} dead miles` });
  if (economics.margin < 0.28) flags.push({ kind: "risk", label: "Low estimated margin" });
  if (competition === "high") flags.push({ kind: "risk", label: "High competition" });
  if (job.collectionWindow.includes("06:00")) flags.push({ kind: "risk", label: "Early collection" });
  if (economics.vehicleFit <= 2) flags.push({ kind: "risk", label: "Vehicle compatibility uncertain" });
  if (onward.rating === "poor") flags.push({ kind: "risk", label: "Poor onward work at destination" });
  if (job.revenue <= 0) flags.push({ kind: "strength", label: "No quotes yet — scored on our lowest" });
  if (job.weightKg == null) flags.push({ kind: "risk", label: "Weight information incomplete" });
  if (economics.profit < profile.minProfit) flags.push({ kind: "risk", label: "Below your minimum profit" });
  if (economics.totalHours > profile.workingHours)
    flags.push({ kind: "risk", label: "Exceeds working hours" });

  return flags.slice(0, 8);
}

function attachPercentiles(jobs: AnalysedJob[]): void {
  const profits = jobs.map((j) => j.profit);
  const hours = jobs.map((j) => j.profitPerHour);
  const deads = jobs.map((j) => j.deadMiles);
  const routes = jobs.map((j) => j.routeFit);
  const scores = jobs.map((j) => j.personalScore);
  for (const job of jobs) {
    const percentiles: Percentiles = {
      profit: percentile(job.profit, profits),
      profitPerHour: percentile(job.profitPerHour, hours),
      deadMiles: 100 - percentile(job.deadMiles, deads),
      routeFit: percentile(job.routeFit, routes),
      personalScore: percentile(job.personalScore, scores),
    };
    job.percentiles = percentiles;
  }
}

function findCombinations(
  jobs: AnalysedJob[],
  profile: OperatorProfile,
): CombinationPlan[] {
  const usable = jobs.filter((j) => j.vehicleFit >= 8 && j.profit > 80);
  const plans: CombinationPlan[] = [];

  for (let i = 0; i < usable.length; i++) {
    const a = usable[i]!;
    for (let j = 0; j < usable.length; j++) {
      if (i === j) continue;
      const b = usable[j]!;
      const gap = roadMiles(a.deliveryCity, b.pickupCity);
      if (gap > 28) continue;
      const hours = a.totalHours + b.totalHours + roadMinutes(a.deliveryCity, b.pickupCity) / 60;
      if (hours > profile.workingHours + 1.25) continue;
      const extraDeadCost = gap * (0.35 + profile.runningCostPerMile);
      const profit = a.profit + b.profit - extraDeadCost;
      const deadMiles = a.deadMiles + gap;
      const score = clamp(
        Math.round(
          55 +
            scale(profit, 200, 900) * 25 +
            scale(profit / hours, 30, 90) * 15 +
            (gap < 12 ? 5 : 0),
        ),
        50,
        99,
      );
      plans.push({
        id: `${a.id}__${b.id}`,
        jobAId: a.id,
        jobBId: b.id,
        label: `${a.pickupCity} → ${a.deliveryCity} → ${b.deliveryCity}`,
        gapMiles: gap,
        revenue: a.revenue + b.revenue,
        costs: round2(a.costs.total + b.costs.total + extraDeadCost),
        profit: round2(profit),
        hours: round2(hours),
        profitPerHour: round2(profit / hours),
        deadMiles: Math.round(deadMiles),
        finishCity: b.deliveryCity,
        finishToHomeMiles: b.deliveryToHomeMiles,
        score,
      });
    }
  }

  plans.sort((a, b) => b.score - a.score || b.profit - a.profit);
  const seen = new Set<string>();
  const unique: CombinationPlan[] = [];
  for (const plan of plans) {
    const key = [plan.jobAId, plan.jobBId].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(plan);
    if (unique.length >= 8) break;
  }
  return unique;
}

function pickWinners(jobs: AnalysedJob[], combinations: CombinationPlan[]): Winners {
  const viable = jobs.filter((j) => j.vehicleFit >= 8 && j.profit > 40);
  const pool = viable.length ? viable : jobs;
  const used = new Set<string>();

  const take = (
    sorted: AnalysedJob[],
    preferUnique = true,
  ): AnalysedJob | null => {
    if (preferUnique) {
      const unique = sorted.find((j) => !used.has(j.id));
      if (unique) {
        used.add(unique.id);
        return unique;
      }
    }
    const first = sorted[0] ?? null;
    if (first) used.add(first.id);
    return first;
  };

  const bestOverall = take([...pool].sort((a, b) => b.score - a.score));
  const highestProfit = take([...pool].sort((a, b) => b.profit - a.profit));
  const bestPerHour = take([...pool].sort((a, b) => b.profitPerHour - a.profitPerHour));
  const lowestDead = take(
    [...pool].filter((j) => j.score >= 58).sort((a, b) => a.deadMiles - b.deadMiles || b.profit - a.profit),
  );
  const towardsHome = take(
    [...pool]
      .filter((j) => j.towardsHomeMiles > 8)
      .sort((a, b) => b.towardsHomeMiles - a.towardsHomeMiles || b.profit - a.profit),
  );

  return {
    bestOverall,
    highestProfit,
    bestPerHour,
    lowestDead,
    towardsHome,
    bestCombination: combinations[0] ?? null,
  };
}

function applyWinnerLabels(jobs: AnalysedJob[], winners: Winners): void {
  const map = new Map(jobs.map((j) => [j.id, j]));
  const assign = (id: string | undefined, kind: AnalysedJob["winnerLabels"][number]) => {
    if (!id) return;
    map.get(id)?.winnerLabels.push(kind);
  };
  assign(winners.bestOverall?.id, "best_overall");
  assign(winners.highestProfit?.id, "highest_profit");
  assign(winners.bestPerHour?.id, "best_per_hour");
  assign(winners.lowestDead?.id, "lowest_dead");
  assign(winners.towardsHome?.id, "towards_home");
}

function summarise(
  jobs: AnalysedJob[],
  profile: OperatorProfile,
  scanned: number,
): MarketSummary {
  const bands: MarketSummary["bands"] = {
    exceptional: jobs.filter((j) => j.band === "exceptional").length,
    strong: jobs.filter((j) => j.band === "strong").length,
    average: jobs.filter((j) => j.band === "average").length,
    weak: jobs.filter((j) => j.band === "weak").length,
    poor: jobs.filter((j) => j.band === "poor").length,
  };
  const destCount = new Map<string, number>();
  for (const job of jobs.filter((j) => j.score >= 78)) {
    destCount.set(job.deliveryCity, (destCount.get(job.deliveryCity) ?? 0) + 1);
  }
  const strongestDestination =
    [...destCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  const nearby = jobs.filter((j) => j.pickupMiles <= 35 && j.vehicleFit >= 8);
  const quality = clamp(
    Math.round(
      40 +
        bands.exceptional * 4 +
        bands.strong * 1.4 +
        nearby.length * 0.8 +
        median(jobs.map((j) => j.profitPerHour)) * 0.25 -
        median(jobs.map((j) => j.deadMiles)) * 0.08,
    ),
    28,
    96,
  );

  return {
    analysed: jobs.length,
    scanned,
    pickupRadiusMiles: profile.maxDeadMiles,
    startingCity: profile.startingCity,
    homeCity: profile.homeCity,
    quality,
    qualityLabel:
      quality >= 76
        ? "Strong market"
        : quality >= 60
          ? "Above average"
          : quality >= 46
            ? "Average"
            : "Thin market",
    bands,
    bestProfit: jobs.length ? Math.max(...jobs.map((j) => j.profit)) : 0,
    bestPerHour: jobs.length ? Math.max(...jobs.map((j) => j.profitPerHour)) : 0,
    medianProfit: median(jobs.map((j) => j.profit)),
    medianPerHour: median(jobs.map((j) => j.profitPerHour)),
    strongestDestination,
  };
}

function competitionLevel(quotes: number, ageMin: number): AnalysedJob["competition"] {
  if (quotes <= 2 && ageMin < 180) return "low";
  if (quotes >= 8 || (quotes >= 5 && ageMin > 240)) return "high";
  return "medium";
}

function confidenceOf(job: RawJob): ConfidenceLevel {
  let known = 3;
  if (job.weightKg != null) known += 1;
  if (job.loadingMinutesKnown) known += 1;
  if (job.revenue > 0) known += 1;
  if (known >= 5) return "high";
  if (known >= 4) return "medium";
  return "low";
}

function bandOf(score: number): ScoreBand {
  if (score >= 88) return "exceptional";
  if (score >= 76) return "strong";
  if (score >= 62) return "average";
  if (score >= 48) return "weak";
  return "poor";
}

function emptyPercentiles(): Percentiles {
  return { profit: 0, profitPerHour: 0, deadMiles: 0, routeFit: 0, personalScore: 0 };
}

function percentile(value: number, all: number[]): number {
  if (all.length === 0) return 50;
  const sorted = [...all].sort((a, b) => a - b);
  const below = sorted.filter((n) => n < value).length;
  return Math.round((below / sorted.length) * 100);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function scale(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return clamp((value - min) / (max - min), 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function simulateOpportunity(
  job: AnalysedJob,
  book: AnalysedJob[],
  profile: OperatorProfile,
  scenario: JobScenario,
) {
  const quote =
    scenario.quote && scenario.quote > 0
      ? scenario.quote
      : job.revenue > 0
        ? job.revenue
        : job.suggestedQuote;
  const economics = costJob(job, profile, { ...scenario, quote });
  const others = book.filter((row) => row.id !== job.id);
  const profits = [...others.map((row) => row.profit), economics.profit];
  const perHours = [...others.map((row) => row.profitPerHour), economics.profitPerHour];
  const deads = [...others.map((row) => row.deadMiles), economics.deadMiles];
  const routes = [...others.map((row) => row.routeFit), economics.routeFit];
  const marketScore = marketScoreOf(economics, profits, perHours, deads, routes);
  const { personalScore } = personalScoreOf(
    job,
    economics,
    { ...profile, startingCity: scenario.startingCity || profile.startingCity },
    job.onward,
    job.competition,
  );
  const score = clamp(Math.round(marketScore * 0.42 + personalScore * 0.58), 1, 99);
  const rank = 1 + others.filter((row) => row.score > score).length;
  return {
    quote,
    profit: economics.profit,
    profitPerHour: economics.profitPerHour,
    margin: economics.margin,
    hours: economics.totalHours,
    miles: economics.totalMiles,
    score,
    rank,
    bookSize: book.length,
    fulfilment: fulfilmentCost(economics.costs),
    costs: economics.costs,
  };
}

export function jobById(jobs: AnalysedJob[], id: string): AnalysedJob | undefined {
  if (!id) return undefined;
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    decoded = id;
  }
  return jobs.find((j) => j.id === id || j.id === decoded);
}
