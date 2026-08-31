"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/context/AppState";
import { compareTradeoff, decisionBoundary, vsHeadline } from "@/lib/explanations";
import { deadMilesSplit, gbp, hasMarketBid, highestBidOf, hoursLabel, jobPath, loadHeadline, milesLabel, minsLabel, routeLabel, workingBid } from "@/lib/format";
import type { AnalysedJob } from "@/lib/types";
import { clsx } from "./clsx";
import { TripDiagram } from "./TripDiagram";
import { BandPill, OpenOnMarketplace, ScoreRing, SourceChip } from "./ui";

export function CompareView() {
  const params = useSearchParams();
  const { market, selectedIds, selectMany, clearSelected, bookStale } = useAppState();
  const fromQuery = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    if (fromQuery.length === 0) return;
    selectMany(fromQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const jobs = market.jobs.filter((j) => selectedIds.includes(j.id)).slice(0, 4);

  if (jobs.length < 2) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-medium">Compare</h1>
        <p className="max-w-xl text-sm text-muted">
          {bookStale ? (
            <>
              These Shiply jobs are more than 5 hours old, so they are hidden.
              Refresh to compare what is still live.
            </>
          ) : (
            <>
              Select two to four jobs on the Jobs page, then come back here to
              see the trade-off.
            </>
          )}
        </p>
        <Link href={bookStale ? "/connect" : "/opportunities"} className="inline-block text-gold">
          {bookStale ? "Refresh from Shiply" : "Choose jobs to compare"}
        </Link>
      </div>
    );
  }

  const { winner, why } = compareTradeoff(jobs);
  const isVs = jobs.length === 2;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">
            {isVs ? "Head to head" : "Side by side"}
          </p>
          <h1 className="mt-1 text-xl font-medium break-words md:text-2xl">
            {isVs
              ? `${jobs[0]!.pickupCity} → ${jobs[0]!.deliveryCity}  vs  ${jobs[1]!.pickupCity} → ${jobs[1]!.deliveryCity}`
              : `${jobs.length} jobs`}
          </h1>
        </div>
        <button type="button" onClick={clearSelected} className="text-sm text-muted hover:text-text">
          Clear selection
        </button>
      </div>

      {isVs ? <VsPanel a={jobs[0]!} b={jobs[1]!} winnerId={winner.id} /> : (
        <div className="space-y-3 md:hidden">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium break-words">
                    {routeLabel(job.pickupCity, job.deliveryCity)}
                  </div>
                  <div className="mt-0.5 text-sm text-muted">{loadHeadline(job)}</div>
                </div>
                <BandPill band={job.band} />
              </div>
              <div className="mt-3">
                <TripDiagram job={job} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 md:hidden">
        {rows(jobs).map((row) => (
          <div key={row.label} className="rounded-lg border border-line bg-panel px-3 py-3">
            <div className="text-sm text-muted">{row.label}</div>
            <div className="mt-2 space-y-1.5 text-base">
              {row.values.map((cell, i) => (
                <div
                  key={jobs[i]!.id}
                  className={clsx("flex justify-between gap-3", cell.best && "text-gold")}
                >
                  <span className="min-w-0 break-words text-sm text-muted">
                    {routeLabel(jobs[i]!.pickupCity, jobs[i]!.deliveryCity)}
                  </span>
                  <span className="shrink-0 tabular">{cell.text}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto overscroll-x-contain rounded-lg border border-line md:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted"> </th>
              {jobs.map((job) => (
                <th key={job.id} className="px-3 py-2 text-left">
                  <Link href={jobPath(job.id)} className="hover:text-gold">
                    {routeLabel(job.pickupCity, job.deliveryCity)}
                  </Link>
                  <div className="mt-1 text-xs font-normal text-muted">
                    {loadHeadline(job)}
                  </div>
                  <div className="mt-2">
                    <SourceChip source={job.source} />
                  </div>
                  <div className="mt-2">
                    <ScoreRing score={job.score} band={job.band} size="sm" />
                  </div>
                  <div className="mt-2">
                    <OpenOnMarketplace
                      source={job.source}
                      href={job.listingUrl}
                      className="px-2 py-1 text-xs"
                    />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows(jobs).map((row) => (
              <tr key={row.label} className="border-t border-line">
                <td className="px-3 py-2 text-muted">{row.label}</td>
                {row.values.map((cell, i) => (
                  <td
                    key={jobs[i]!.id}
                    className={clsx(
                      "px-3 py-2 tabular",
                      cell.best && "text-gold",
                    )}
                  >
                    {cell.text}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-lg border border-gold/25 bg-panel p-4">
        <div className="text-[11px] uppercase tracking-wider text-gold">Recommended</div>
        <h2 className="mt-1 text-lg font-medium">
          {routeLabel(winner.pickupCity, winner.deliveryCity)}
        </h2>
        <p className="mt-1 text-sm text-muted">{loadHeadline(winner)}</p>
        <div className="mt-3 max-w-xl">
          <TripDiagram job={winner} size="sm" />
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6">{why}</p>
        <div className="mt-4">
          <div className="text-sm text-gold">This lead changes if</div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
            {decisionBoundary(winner, jobs.find((j) => j.id !== winner.id)).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <p className="mt-3 text-sm text-muted">
          The score does not override a real-life constraint. If you must finish
          near home, prefer the job that closes that gap even when it ranks lower.
        </p>
      </section>
    </div>
  );
}

function VsPanel({
  a,
  b,
  winnerId,
}: {
  a: AnalysedJob;
  b: AnalysedJob;
  winnerId: string;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[a, b].map((job) => (
        <div
          key={job.id}
          className={clsx(
            "rounded-lg border bg-panel p-4",
            job.id === winnerId ? "border-gold/40" : "border-line",
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{routeLabel(job.pickupCity, job.deliveryCity)}</div>
              <div className="mt-0.5 text-sm text-muted">{loadHeadline(job)}</div>
              <div className="mt-2">
                <SourceChip source={job.source} />
              </div>
            </div>
            <BandPill band={job.band} />
          </div>
          <div className="mt-3">
            <TripDiagram job={job} size="sm" />
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {vsHeadline(job, job.id === a.id ? b : a).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {job.id === winnerId ? (
            <div className="mt-3 text-xs uppercase tracking-wider text-gold">Leads on balance</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function rows(jobs: AnalysedJob[]) {
  const best = (values: number[], higher = true) => {
    const target = higher ? Math.max(...values) : Math.min(...values);
    return values.map((v) => v === target);
  };
  const pack = (label: string, values: string[], marks: boolean[]) => ({
    label,
    values: values.map((text, i) => ({ text, best: marks[i] })),
  });

  return [
    pack(
      "Carrying",
      jobs.map((j) => loadHeadline(j)),
      jobs.map(() => false),
    ),
    pack(
      "Score",
      jobs.map((j) => String(j.score)),
      best(jobs.map((j) => j.score)),
    ),
    pack(
      jobs.every((j) => j.source === "Shiply")
        ? jobs.every((j) => hasMarketBid(j))
          ? "Lowest bid"
          : "Lowest / our lowest"
        : "Bid / budget",
      jobs.map((j) =>
        hasMarketBid(j) ? gbp(j.revenue) : `Our lowest ${gbp(workingBid(j))}`,
      ),
      best(jobs.map((j) => workingBid(j))),
    ),
    ...(jobs.some((j) => highestBidOf(j))
      ? [
          pack(
            "Highest bid",
            jobs.map((j) => (highestBidOf(j) ? gbp(highestBidOf(j)!) : "—")),
            best(jobs.map((j) => highestBidOf(j) ?? 0)),
          ),
        ]
      : []),
    pack(
      "Profit",
      jobs.map((j) => gbp(j.profit)),
      best(jobs.map((j) => j.profit)),
    ),
    pack(
      "Profit / hour",
      jobs.map((j) => gbp(j.profitPerHour)),
      best(jobs.map((j) => j.profitPerHour)),
    ),
    pack(
      "Dead miles",
      jobs.map((j) => `${milesLabel(j.deadMiles)} · ${deadMilesSplit(j.pickupMiles, j.deliveryToHomeMiles)}`),
      best(jobs.map((j) => j.deadMiles), false),
    ),
    pack(
      "Empty time",
      jobs.map((j) => minsLabel(j.pickupMinutes + j.deliveryToHomeMinutes)),
      best(jobs.map((j) => j.pickupMinutes + j.deliveryToHomeMinutes), false),
    ),
    pack(
      "Total miles",
      jobs.map((j) => milesLabel(j.totalMiles)),
      best(jobs.map((j) => j.totalMiles), false),
    ),
    pack(
      "Time",
      jobs.map((j) => hoursLabel(j.totalHours)),
      best(jobs.map((j) => j.totalHours), false),
    ),
    pack(
      "Empty home",
      jobs.map((j) => `${milesLabel(j.deliveryToHomeMiles)} · ${minsLabel(j.deliveryToHomeMinutes)}`),
      best(jobs.map((j) => j.deliveryToHomeMiles), false),
    ),
    pack(
      "Towards home",
      jobs.map((j) => (j.towardsHomeMiles > 10 ? `Yes · ${milesLabel(j.towardsHomeMiles)}` : "No")),
      best(jobs.map((j) => j.towardsHomeMiles)),
    ),
    pack(
      "Onward market",
      jobs.map((j) => j.onward.rating),
      jobs.map((j) => j.onward.rating === "excellent"),
    ),
    pack(
      "Vehicle fit",
      jobs.map((j) => `${j.vehicleFit}/10`),
      best(jobs.map((j) => j.vehicleFit)),
    ),
    pack(
      "Source",
      jobs.map((j) => j.source),
      jobs.map(() => false),
    ),
  ];
}
