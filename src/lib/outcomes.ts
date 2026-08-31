import { gbp, routeLabel } from "./format";
import type { AnalysedJob, JobOutcome, OutcomeKind } from "./types";

export function outcomeLabel(kind: OutcomeKind): string {
  switch (kind) {
    case "quoted":
      return "Quoted";
    case "won":
      return "Won";
    case "lost":
      return "Lost";
    case "skipped":
      return "Did not quote";
  }
}

export function makeOutcome(job: AnalysedJob, kind: OutcomeKind): JobOutcome {
  return {
    id: crypto.randomUUID(),
    jobId: job.id,
    kind,
    route: routeLabel(job.pickupCity, job.deliveryCity),
    profit: job.profit,
    revenue: job.revenue,
    at: new Date().toISOString(),
  };
}

export function latestOutcome(outcomes: JobOutcome[], jobId: string): JobOutcome | null {
  return outcomes.find((o) => o.jobId === jobId) ?? null;
}

export function wonNorms(outcomes: JobOutcome[]): {
  count: number;
  medianProfit: number;
  medianRevenue: number;
} | null {
  const won = outcomes.filter((o) => o.kind === "won");
  if (won.length < 2) return null;
  const profits = [...won.map((o) => o.profit)].sort((a, b) => a - b);
  const revenues = [...won.map((o) => o.revenue)].sort((a, b) => a - b);
  const mid = (values: number[]) => {
    const i = Math.floor(values.length / 2);
    return values.length % 2 ? values[i]! : (values[i - 1]! + values[i]!) / 2;
  };
  return {
    count: won.length,
    medianProfit: mid(profits),
    medianRevenue: mid(revenues),
  };
}

export function vsYourNorms(job: AnalysedJob, outcomes: JobOutcome[]): string {
  const norms = wonNorms(outcomes);
  if (!norms) {
    return "Record two won jobs and this figure becomes ‘versus the work you normally take’.";
  }
  const delta = job.profit - norms.medianProfit;
  if (Math.abs(delta) < 15) {
    return `In line with the ${norms.count} jobs you marked won (median ${gbp(norms.medianProfit)} profit).`;
  }
  return delta > 0
    ? `${gbp(delta)} more profit than your usual won work (median ${gbp(norms.medianProfit)} from ${norms.count} jobs).`
    : `${gbp(-delta)} less profit than your usual won work (median ${gbp(norms.medianProfit)} from ${norms.count} jobs).`;
}

export function weekWins(outcomes: JobOutcome[], now = Date.now()): JobOutcome[] {
  const week = 7 * 24 * 60 * 60 * 1000;
  return outcomes.filter((o) => o.kind === "won" && now - Date.parse(o.at) <= week);
}
