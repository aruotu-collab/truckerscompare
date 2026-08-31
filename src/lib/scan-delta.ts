import { gbp, hasMarketBid, highestBidOf, routeLabel, workingBid } from "./format";
import type { AnalysedJob, AnalysedMarket, MarketMovement } from "./types";

export interface JobSnap {
  id: string;
  revenue: number;
  highestBid: number;
  quoteCount: number;
  pickup: string;
  delivery: string;
}

export interface ScanSnapshot {
  at: string;
  fingerprint: string;
  leaderId: string | null;
  jobs: Record<string, JobSnap>;
}

export function bookFingerprint(
  jobs: { id: string; revenue: number; highestBid?: number | null; quoteCount: number }[],
): string {
  return [...jobs]
    .map((j) => `${j.id}:${j.revenue}:${j.highestBid ?? 0}:${j.quoteCount}`)
    .sort()
    .join("|");
}

export function snapshotFromMarket(market: AnalysedMarket): ScanSnapshot {
  const jobs: Record<string, JobSnap> = {};
  for (const job of market.jobs) {
    jobs[job.id] = {
      id: job.id,
      revenue: job.revenue,
      highestBid: highestBidOf(job) ?? 0,
      quoteCount: job.quoteCount,
      pickup: job.pickupCity,
      delivery: job.deliveryCity,
    };
  }
  return {
    at: new Date().toISOString(),
    fingerprint: bookFingerprint(market.jobs),
    leaderId: market.winners.bestOverall?.id ?? null,
    jobs,
  };
}

export function diffScans(
  prev: ScanSnapshot | null,
  next: ScanSnapshot,
  watchedIds: string[],
): MarketMovement[] {
  if (!prev || prev.fingerprint === next.fingerprint) return [];

  const watched = new Set(watchedIds);
  const out: MarketMovement[] = [];

  if (next.leaderId && next.leaderId !== prev.leaderId) {
    const lead = next.jobs[next.leaderId];
    if (lead) {
      out.push({
        kind: "new_leader",
        jobId: lead.id,
        label: `${routeLabel(lead.pickup, lead.delivery)} is now Best Overall`,
        detail: "The top job changed since the last look.",
        watched: watched.has(lead.id),
      });
    }
  }

  for (const job of Object.values(next.jobs)) {
    const before = prev.jobs[job.id];
    if (!before) {
      out.push({
        kind: "new",
        jobId: job.id,
        label: `New · ${routeLabel(job.pickup, job.delivery)}`,
        detail: job.revenue > 0 ? `Lowest ${gbp(job.revenue)}` : "No live quotes yet",
        watched: watched.has(job.id),
      });
      continue;
    }
    const bidNow = job.revenue;
    const bidWas = before.revenue;
    if (bidNow > 0 && bidWas > 0 && bidNow !== bidWas) {
      const up = bidNow > bidWas;
      out.push({
        kind: up ? "bid_up" : "bid_down",
        jobId: job.id,
        label: `${up ? "Lowest rose" : "Lowest dropped"} · ${routeLabel(job.pickup, job.delivery)}`,
        detail: `${gbp(bidWas)} → ${gbp(bidNow)}`,
        watched: watched.has(job.id),
      });
    }
    if (job.quoteCount > before.quoteCount) {
      out.push({
        kind: "quotes_up",
        jobId: job.id,
        label: `More quotes · ${routeLabel(job.pickup, job.delivery)}`,
        detail: `${before.quoteCount} → ${job.quoteCount} quotes`,
        watched: watched.has(job.id),
      });
    }
  }

  for (const before of Object.values(prev.jobs)) {
    if (next.jobs[before.id]) continue;
    out.push({
      kind: "gone",
      jobId: before.id,
      label: `Left the list · ${routeLabel(before.pickup, before.delivery)}`,
      detail: "It was in the last scan and is not here now.",
      watched: watched.has(before.id),
    });
  }

  const watchedHits = out.filter((m) => m.watched && m.kind !== "new_leader");
  for (const hit of watchedHits.slice(0, 4)) {
    out.unshift({
      kind: "watched",
      jobId: hit.jobId,
      label: `Watched · ${hit.label}`,
      detail: hit.detail,
      watched: true,
    });
  }

  return out.slice(0, 16);
}

export function movementOf(job: AnalysedJob, movements: MarketMovement[]): MarketMovement | null {
  return (
    movements.find((m) => m.jobId === job.id && (m.kind === "new" || m.kind === "bid_down" || m.kind === "bid_up")) ??
    null
  );
}

export function liveBidLabel(job: AnalysedJob): string {
  if (!hasMarketBid(job)) return "No live quotes";
  return `Lowest ${gbp(workingBid(job))}`;
}
