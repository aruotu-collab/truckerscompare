import { gbp, hoursLabel, pickupRadiusLabel, routeLabel } from "./format";
import type { AnalysedMarket, JobOutcome, MarketMovement } from "./types";
import { weekWins } from "./outcomes";

export function dailyBrief(
  market: AnalysedMarket,
  movements: MarketMovement[],
  outcomes: JobOutcome[],
): { title: string; body: string; quality: string } {
  const { market: summary, winners, combinations } = market;
  const best = winners.bestOverall;
  const combo = winners.bestCombination;
  const fresh = movements.filter((m) => m.kind === "new").length;
  const gone = movements.filter((m) => m.kind === "gone").length;
  const watched = movements.filter((m) => m.kind === "watched").length;
  const wins = weekWins(outcomes);

  const quality =
    summary.quality >= 76
      ? "Act on the winners — the book is strong enough not to wait."
      : summary.quality >= 46
        ? "A mixed book. Take a winner if it fits; otherwise wait for the next refresh."
        : "Thin book. Widen the radius or refresh later rather than forcing a weak job.";

  const parts: string[] = [];
  parts.push(
    `I inspected ${summary.analysed} jobs within ${pickupRadiusLabel(summary.pickupRadiusMiles).toLowerCase()} of ${summary.searchLocation}. The list looks ${summary.qualityLabel.toLowerCase()}.`,
  );
  if (best) {
    parts.push(
      `Best use of the vehicle is ${routeLabel(best.pickupCity, best.deliveryCity)} — about ${gbp(best.profit)} profit at ${gbp(best.profitPerHour)}/hour.`,
    );
  }
  if (combo && best && combo.profit > best.profit + 40) {
    parts.push(
      `A ${combo.stops === 3 ? "three" : "two"}-job day (${combo.label}) beats that single load by ${gbp(combo.profit - best.profit)} over ${hoursLabel(combo.hours)}.`,
    );
  }
  if (fresh || gone) {
    parts.push(
      `${fresh ? `${fresh} new listing${fresh === 1 ? "" : "s"}` : ""}${fresh && gone ? " and " : ""}${gone ? `${gone} left the list` : ""} since the last look.`,
    );
  }
  if (watched) {
    parts.push(`${watched} watched job${watched === 1 ? "" : "s"} moved.`);
  }
  if (wins.length) {
    const pot = wins.reduce((sum, o) => sum + o.profit, 0);
    parts.push(`This week you marked ${wins.length} won, about ${gbp(pot)} estimated profit.`);
  }

  return {
    title: best
      ? `Best overall: ${routeLabel(best.pickupCity, best.deliveryCity)}`
      : "No jobs to brief yet",
    body: parts.join(" "),
    quality,
  };
}
