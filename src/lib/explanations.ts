import { deadMilesSplit, gbp, hoursLabel, milesLabel, num, routeLabel } from "./format";
import type { AnalysedJob, CombinationPlan } from "./types";

export function intelligenceSummary(job: AnalysedJob): string {
  if (job.winnerLabels.includes("best_overall")) {
    return `From ${job.pickupCity === job.pickupCity ? "your current book" : "today's book"}, this is the strongest overall use of the vehicle: ${gbp(job.profit)} estimated profit at ${gbp(job.profitPerHour)}/hour with ${Math.round(job.deadMiles)} dead miles.`;
  }
  if (job.winnerLabels.includes("towards_home")) {
    return `Not the highest standalone profit, but it earns about ${gbp(job.profit)} while cutting the remaining journey home by ${milesLabel(job.towardsHomeMiles)}. That can be worth more than a richer job heading the wrong way.`;
  }
  if (job.winnerLabels.includes("best_per_hour")) {
    return `This is not today's highest-revenue opportunity, but ${gbp(job.profitPerHour)}/hour and only ${Math.round(job.deadMiles)} dead miles make it the hardest-working use of time in the current book.`;
  }
  if (job.winnerLabels.includes("highest_profit")) {
    return `Highest estimated cash left after real costs — ${gbp(job.profit)}. Check hours and finish location before treating that as the job to take.`;
  }
  if (job.score >= 88) {
    return `Unusually strong on both market quality and your economics. Low empty running and ${gbp(job.profitPerHour)}/hour put it in the top tier of what is available to you right now.`;
  }
  if (job.band === "poor" || job.band === "weak") {
    return `The headline ${gbp(job.revenue)} looks workable until fuel, dead miles and time are applied. Estimated real profit is ${gbp(job.profit)} — below the jobs that deserve attention today.`;
  }
  return `Solid but not outstanding. ${gbp(job.profit)} profit and ${gbp(job.profitPerHour)}/hour sit near the middle of today's book. Use compare if you are choosing between this and a winner.`;
}

export function whyStrengths(job: AnalysedJob): string[] {
  const out: string[] = [];
  if (job.percentiles.profitPerHour >= 90)
    out.push(`Top ${100 - job.percentiles.profitPerHour}% profit/hour`);
  if (job.deadMiles <= 16)
    out.push(`Only ${Math.round(job.deadMiles)} dead miles (${deadMilesSplit(job.pickupMiles, job.deliveryToHomeMiles)})`);
  if (job.pickupMiles <= 10) out.push(`Pickup only ${Math.round(job.pickupMiles)} miles away`);
  if (job.vehicleFit >= 8) out.push("Excellent vehicle fit");
  if (job.onward.rating === "excellent" || job.onward.rating === "good")
    out.push(`${job.onward.rating === "excellent" ? "Excellent" : "Good"} onward market`);
  if (job.towardsHomeMiles >= 20)
    out.push(`Moves you ${milesLabel(job.towardsHomeMiles)} closer to home`);
  if (job.vsTargetHour > 0)
    out.push(`${gbp(job.vsTargetHour)}/hour above your target`);
  return out.slice(0, 6);
}

export function whyWeaknesses(job: AnalysedJob): string[] {
  const out: string[] = [];
  if (job.collectionWindow.toLowerCase().includes("06:00")) out.push("Early collection");
  if (job.percentiles.profit < 55) out.push("Revenue / profit below today's best-paid work");
  if (job.weightKg == null) out.push("Weight information incomplete");
  if (job.deadMiles >= 40)
    out.push(`${Math.round(job.deadMiles)} dead miles (${deadMilesSplit(job.pickupMiles, job.deliveryToHomeMiles)})`);
  if (job.onward.rating === "poor") out.push("Destination has weak onward work");
  if (job.competition === "high") out.push("Quote activity is already high");
  if (job.vsMinProfit < 0) out.push("Below your minimum profit");
  if (job.confidence !== "high") out.push("Some job details are estimated");
  return out.slice(0, 5);
}

export function compareTradeoff(jobs: AnalysedJob[]): { winner: AnalysedJob; why: string } {
  const ranked = [...jobs].sort((a, b) => b.score - a.score);
  const winner = ranked[0]!;
  if (jobs.length === 1) {
    return { winner, why: "Only one job selected." };
  }
  const others = ranked.slice(1);
  const richest = [...jobs].sort((a, b) => b.revenue - a.revenue)[0]!;
  const fastest = [...jobs].sort((a, b) => b.profitPerHour - a.profitPerHour)[0]!;
  const closestHome = [...jobs].sort((a, b) => a.deliveryToHomeMiles - b.deliveryToHomeMiles)[0]!;

  const parts: string[] = [];
  if (richest.id !== winner.id) {
    const extraRev = richest.revenue - winner.revenue;
    const extraProfit = winner.profit - richest.profit;
    parts.push(
      `${routeLabel(richest.pickupCity, richest.deliveryCity)} pays ${gbp(extraRev)} more revenue, but extra dead miles and time mean ${routeLabel(winner.pickupCity, winner.deliveryCity)} is expected to produce ${gbp(Math.abs(extraProfit))} ${extraProfit >= 0 ? "more" : "less"} profit.`,
    );
  }
  if (fastest.id !== winner.id) {
    parts.push(
      `${routeLabel(fastest.pickupCity, fastest.deliveryCity)} generates ${gbp(fastest.profitPerHour - winner.profitPerHour)}/hour more, but ${routeLabel(winner.pickupCity, winner.deliveryCity)} is the stronger balance of profit, route and onward work.`,
    );
  }
  if (closestHome.id !== winner.id && closestHome.deliveryToHomeMiles + 30 < winner.deliveryToHomeMiles) {
    parts.push(
      `If getting home tonight is the priority, ${routeLabel(closestHome.pickupCity, closestHome.deliveryCity)} finishes ${milesLabel(winner.deliveryToHomeMiles - closestHome.deliveryToHomeMiles)} closer to home — the score does not override that.`,
    );
  }
  if (parts.length === 0) {
    parts.push(
      `${routeLabel(winner.pickupCity, winner.deliveryCity)} leads on the numbers that matter for this vehicle: ${gbp(winner.profit)} profit, ${gbp(winner.profitPerHour)}/hour, ${Math.round(winner.deadMiles)} dead miles.`,
    );
  }
  return { winner, why: parts.join(" ") };
}

export function vsHeadline(a: AnalysedJob, b: AnalysedJob): string[] {
  const lines: string[] = [];
  const dProfit = a.profit - b.profit;
  const dHour = a.profitPerHour - b.profitPerHour;
  const dDead = b.deadMiles - a.deadMiles;
  const dHome = b.deliveryToHomeMiles - a.deliveryToHomeMiles;
  if (dProfit !== 0) lines.push(`${dProfit > 0 ? "+" : ""}${gbp(dProfit)} expected profit`);
  if (dHour !== 0) lines.push(`${dHour > 0 ? "+" : ""}${gbp(dHour)}/hour`);
  if (dDead !== 0)
    lines.push(
      `${dDead > 0 ? `${Math.round(dDead)} fewer` : `${Math.round(-dDead)} more`} dead miles`,
    );
  if (dHome > 15) lines.push(`${milesLabel(dHome)} closer to home`);
  if (dHome < -15) lines.push(`${milesLabel(-dHome)} further from home`);
  return lines;
}

export function combinationWhy(plan: CombinationPlan, single: AnalysedJob | null): string {
  if (!single) {
    return `Two compatible jobs with ${milesLabel(plan.gapMiles)} between drop and next collection. Combined profit ${gbp(plan.profit)} over ${hoursLabel(plan.hours)}.`;
  }
  const extra = plan.profit - single.profit;
  const home = single.deliveryToHomeMiles - plan.finishToHomeMiles;
  return `Versus taking only ${routeLabel(single.pickupCity, single.deliveryCity)}, this pair is ${gbp(extra)} more profit and finishes ${home > 0 ? milesLabel(home) + " closer to home" : milesLabel(-home) + " further from home"}. Trade-off: one extra collection and delivery.`;
}

export function decisionBoundary(winner: AnalysedJob, rival: AnalysedJob | undefined): string[] {
  if (!rival) {
    return [
      `Loading time exceeds ${num(winner.totalHours + 2.1, 1)} hours`,
      `Fuel moves well above your current ${gbp(winner.costs.fuel)} estimate`,
    ];
  }
  const quoteGap = Math.max(40, Math.round(winner.profit - rival.profit + 80));
  return [
    `Dead / loading time on ${winner.pickupCity} → ${winner.deliveryCity} exceeds ${hoursLabel(winner.totalHours + 1.4)}`,
    `You can win ${rival.pickupCity} → ${rival.deliveryCity} above ${gbp(rival.revenue + quoteGap)}`,
    `Your fuel cost rises enough to wipe the ${gbp(Math.abs(winner.profit - rival.profit))} profit gap`,
  ];
}
