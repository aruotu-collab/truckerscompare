"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAppState } from "@/context/AppState";
import { compareTradeoff, vsHeadline } from "@/lib/explanations";
import { gbp, hoursLabel, milesLabel, routeLabel } from "@/lib/format";
import type { AnalysedJob } from "@/lib/types";
import { clsx } from "./clsx";
import { BandPill, ScoreRing } from "./ui";

export function CompareView() {
  const params = useSearchParams();
  const { market, selectedIds, selectMany, clearSelected } = useAppState();
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
          Select two to four opportunities from the grid. Side-by-side is a
          flagship feature — the point is the trade-off, not a second table of
          the same numbers.
        </p>
        <Link href="/opportunities" className="inline-block text-gold">
          Choose jobs to compare
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
          <h1 className="mt-1 text-2xl font-medium">
            {isVs
              ? `${jobs[0]!.pickupCity} → ${jobs[0]!.deliveryCity}  vs  ${jobs[1]!.pickupCity} → ${jobs[1]!.deliveryCity}`
              : `${jobs.length} opportunities`}
          </h1>
        </div>
        <button type="button" onClick={clearSelected} className="text-sm text-muted hover:text-text">
          Clear selection
        </button>
      </div>

      {isVs ? <VsPanel a={jobs[0]!} b={jobs[1]!} winnerId={winner.id} /> : null}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-panel-2">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted"> </th>
              {jobs.map((job) => (
                <th key={job.id} className="px-3 py-2 text-left">
                  <Link href={`/opportunities/${job.id}`} className="hover:text-gold">
                    {routeLabel(job.pickupCity, job.deliveryCity)}
                  </Link>
                  <div className="mt-2">
                    <ScoreRing score={job.score} band={job.band} size="sm" />
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
        <p className="mt-3 max-w-3xl text-sm leading-6">{why}</p>
        <p className="mt-3 text-xs text-muted">
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
            <div className="font-medium">{routeLabel(job.pickupCity, job.deliveryCity)}</div>
            <BandPill band={job.band} />
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
      "Score",
      jobs.map((j) => String(j.score)),
      best(jobs.map((j) => j.score)),
    ),
    pack(
      "Revenue",
      jobs.map((j) => gbp(j.revenue)),
      best(jobs.map((j) => j.revenue)),
    ),
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
      jobs.map((j) => milesLabel(j.deadMiles)),
      best(jobs.map((j) => j.deadMiles), false),
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
      "Finish to home",
      jobs.map((j) => milesLabel(j.deliveryToHomeMiles)),
      best(jobs.map((j) => j.deliveryToHomeMiles), false),
    ),
    pack(
      "Source",
      jobs.map((j) => j.source),
      jobs.map(() => false),
    ),
  ];
}
