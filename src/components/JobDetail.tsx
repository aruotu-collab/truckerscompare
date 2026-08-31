"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAppState } from "@/context/AppState";
import { jobById } from "@/lib/engine";
import {
  decisionBoundary,
  intelligenceSummary,
  whyStrengths,
  whyWeaknesses,
} from "@/lib/explanations";
import {
  betterThan,
  confidenceLabel,
  gbp,
  hasMarketBid,
  highestBidOf,
  hoursLabel,
  loadHeadline,
  loadLabel,
  marketPriceLabel,
  deadMilesSplit,
  milesLabel,
  minsLabel,
  normalizeJobId,
  postedLabel,
  routeLabel,
  vehicleLabel,
  workingBid,
} from "@/lib/format";
import { latestOutcome, outcomeLabel, vsYourNorms } from "@/lib/outcomes";
import { QuoteDecision } from "./QuoteDecision";
import { TripDiagram } from "./TripDiagram";
import { BandPill, JobFlags, Metric, Money, OpenOnMarketplace, ScoreRing, SourceChip, WinnerChip } from "./ui";
import { clsx } from "./clsx";
import type { OutcomeKind } from "@/lib/types";

type DetailTab = "summary" | "quote" | "fit";

export function JobDetail() {
  const id = normalizeJobId(useParams<{ id: string | string[] }>().id);
  const {
    market,
    profile,
    selectedIds,
    toggleSelected,
    toggleSaved,
    savedIds,
    dismiss,
    bookStale,
    outcomes,
    recordOutcome,
    workingJobId,
    startWorking,
  } = useAppState();
  const [tab, setTab] = useState<DetailTab>("summary");
  const job = jobById(market.jobs, id);

  if (!job) {
    return (
      <div>
        <p className="text-muted">
          {bookStale
            ? "This listing is hidden because the Shiply jobs are more than 5 hours old. Refresh to pull what is still live."
            : "That job is not in this list."}
        </p>
        <Link href={bookStale ? "/connect" : "/opportunities"} className="mt-3 inline-block text-gold">
          {bookStale ? "Refresh from Shiply" : "Back to jobs"}
        </Link>
      </div>
    );
  }

  const rival = market.jobs.find((j) => j.id !== job.id && j.score >= job.score - 8);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href="/opportunities" className="text-sm text-muted hover:text-text">
            ← Jobs
          </Link>
          <h1 className="mt-2 text-2xl font-medium">
            {routeLabel(job.pickupCity, job.deliveryCity)}
          </h1>
          <p className="mt-1 text-sm">{loadHeadline(job)}</p>
          <p className="mt-1 text-sm text-muted">
            {job.category}
            {job.collectionWindow && job.collectionWindow !== "Window not given"
              ? ` · Collect ${job.collectionWindow}`
              : ` · Posted ${postedLabel(job.postedMinutesAgo)}`}
            {job.source === "Shiply"
              ? hasMarketBid(job)
                ? ` · ${job.quoteCount} quotes · lowest ${gbp(job.revenue)}${
                    highestBidOf(job) ? ` · highest ${gbp(highestBidOf(job)!)}` : ""
                  }`
                : " · no quotes yet · scored on our lowest"
              : ` · ${job.quoteCount} quotes`}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs uppercase tracking-wider text-muted">Your score</div>
            <ScoreRing score={job.score} band={job.band} size="lg" />
          </div>
          <div className="text-right text-sm">
            <div className="text-muted">Market score</div>
            <div className="tabular text-lg">{job.marketScore}</div>
            <div className="mt-2 text-muted">Confidence</div>
            <div>{confidenceLabel(job.confidence)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-line bg-panel px-2 py-3">
        <TripDiagram job={job} />
      </div>

      <div className="flex flex-wrap gap-2">
        <SourceChip source={job.source} />
        {job.winnerLabels.map((w) => (
          <WinnerChip key={w} kind={w} />
        ))}
        <BandPill band={job.band} />
      </div>

      <div className="flex flex-wrap gap-2">
        <OpenOnMarketplace source={job.source} href={job.listingUrl} />
        <button
          type="button"
          onClick={() => toggleSelected(job.id)}
          className={clsx(
            "min-h-11 rounded-md px-4 py-2 text-base md:min-h-0 md:px-3 md:py-1.5 md:text-sm",
            selectedIds.includes(job.id) ? "bg-gold text-ink" : "border border-line",
          )}
        >
          {selectedIds.includes(job.id) ? "Selected for compare" : "Add to compare"}
        </button>
        <button
          type="button"
          onClick={() => toggleSaved(job.id)}
          className="min-h-11 rounded-md border border-line px-4 py-2 text-base md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
        >
          {savedIds.includes(job.id) ? "Watching" : "Watch"}
        </button>
        <button
          type="button"
          onClick={() => startWorking(workingJobId === job.id ? null : job.id)}
          className="min-h-11 rounded-md border border-line px-4 py-2 text-base md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
        >
          {workingJobId === job.id ? "Working this" : "Start my day"}
        </button>
        <button
          type="button"
          onClick={() => dismiss(job.id)}
          className="min-h-11 rounded-md border border-line px-4 py-2 text-base text-muted md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
        >
          Dismiss
        </button>
        {selectedIds.length > 0 ? (
          <Link
            href={`/compare?ids=${[...new Set([job.id, ...selectedIds])].slice(0, 4).join(",")}`}
            className="inline-flex min-h-11 items-center rounded-md border border-gold/40 px-4 py-2 text-base text-gold md:min-h-0 md:px-3 md:py-1.5 md:text-sm"
          >
            Open compare
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Outcome</span>
        {(["quoted", "won", "lost", "skipped"] as OutcomeKind[]).map((kind) => {
          const current = latestOutcome(outcomes, job.id);
          const active = current?.kind === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => recordOutcome(job, kind)}
              className={clsx(
                "min-h-11 rounded-md border px-3 py-2 text-sm",
                active ? "border-gold text-gold" : "border-line text-muted",
              )}
            >
              {outcomeLabel(kind)}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric
          label={marketPriceLabel(job)}
          hint={
            job.source === "Shiply"
              ? hasMarketBid(job)
                ? `${job.quoteCount} live quotes. Profit below uses this bid.`
                : "No live quotes. Profit below uses our calculated lowest."
              : "Marketplace customer budget"
          }
        >
          <Money value={workingBid(job)} />
        </Metric>
        {highestBidOf(job) ? (
          <Metric label="Highest bid" hint="Current top live quote on Shiply">
            <Money value={highestBidOf(job)!} />
          </Metric>
        ) : null}
        <Metric
          label="Estimated profit"
          hint={`${job.profit >= market.market.medianProfit ? "+" : "−"}${gbp(Math.abs(job.profit - market.market.medianProfit))} vs today's median`}
        >
          <Money value={job.profit} className="text-gold" />
        </Metric>
        <Metric label="Profit / hour" hint={betterThan(job.percentiles.profitPerHour)}>
          {gbp(job.profitPerHour)}
        </Metric>
        <Metric
          label="Dead miles"
          hint={`${deadMilesSplit(job.pickupMiles, job.deliveryToHomeMiles)}. ${betterThan(job.percentiles.deadMiles)}`}
        >
          {milesLabel(job.deadMiles)}
        </Metric>
      </div>

      <div className="md:sticky md:top-14 md:z-10 md:-mx-6 md:border-y md:border-line md:bg-ink/95 md:px-6 md:backdrop-blur">
        <div className="flex gap-2 overflow-x-auto overscroll-x-contain py-2">
          {(
            [
              ["summary", "Summary"],
              ["quote", "Quote"],
              ["fit", "Fit"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={clsx(
                "min-h-11 min-w-[5.5rem] shrink-0 rounded-md px-4 py-2 text-base md:min-h-0 md:min-w-0 md:px-3 md:py-1.5 md:text-sm",
                tab === key ? "bg-gold text-ink" : "border border-line text-muted hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "summary" ? (
      <>
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">What you are carrying</h2>
        <p className="mt-2 text-sm leading-6">{loadLabel(job)}</p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Category" value={job.category} />
          <Row
            label="Weight"
            value={job.weightKg != null ? `${job.weightKg} kg` : "Not given"}
            muted={job.weightKg == null}
          />
          <Row label="Vehicle asked" value={vehicleLabel(job.vehicleRequired)} />
          <Row
            label="Loading time"
            value={job.loadingMinutesKnown ? "Known" : "Not given"}
            muted={!job.loadingMinutesKnown}
          />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium">Route</h2>
            <p className="mt-1 text-xs text-muted">
              Start → pickup → delivery → home. Miles and times from the UK road
              network, not crow-flies.
            </p>
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted">
            {job.routeSource === "osrm"
              ? "Road network"
              : job.routeSource === "mixed"
                ? "Road + estimate"
                : "Estimated"}
          </div>
        </div>
        <ol className="mt-4 space-y-3">
          {job.legs.map((leg) => (
            <li
              key={`${leg.kind}-${leg.from}-${leg.to}`}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <div className="text-sm">
                  {leg.from} → {leg.to}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-muted">
                  {leg.kind === "deadhead"
                    ? "Empty to collect"
                    : leg.kind === "loaded"
                      ? "Loaded run"
                      : "Empty home"}
                </div>
              </div>
              <div className="text-right text-sm tabular">
                <div>{milesLabel(leg.miles)}</div>
                <div className="text-xs text-muted">{minsLabel(leg.minutes)}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-xs text-muted">
          Working drive {minsLabel(job.pickupMinutes + job.loadedMinutes)}, then{" "}
          {minsLabel(job.deliveryToHomeMinutes)} empty home to{" "}
          {profile.homeLocation.trim() || profile.homeCity}. Direct home from
          here would be {minsLabel(job.startToHomeMinutes)}.
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Real cost of this job</h2>
          <p className="mt-1 text-xs text-muted">
            {job.source === "Shiply"
              ? hasMarketBid(job)
                ? "Lowest current Shiply bid is the starting number. These are the hidden costs."
                : "No live quotes yet. Costs below use our calculated lowest."
              : "Marketplace number is revenue. These are the hidden costs."}
          </p>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label={marketPriceLabel(job)} value={gbp(workingBid(job))} />
            {highestBidOf(job) ? (
              <Row label="Highest bid" value={gbp(highestBidOf(job)!)} />
            ) : null}
            <Row label="Fuel" value={`− ${gbp(job.costs.fuel)}`} muted />
            <Row label="Vehicle running" value={`− ${gbp(job.costs.vehicle)}`} muted />
            <Row
              label="of which empty miles (collect + home)"
              value={gbp(job.costs.deadMile)}
              muted
            />
            <Row label="Driver time" value={`− ${gbp(job.costs.driverTime)}`} muted />
            <Row label="Marketplace fees" value={`− ${gbp(job.costs.fees)}`} muted />
            <Row label="Tolls (est.)" value={`− ${gbp(job.costs.tolls)}`} muted />
            {job.costs.helper > 0 ? (
              <Row label="Helper" value={`− ${gbp(job.costs.helper)}`} muted />
            ) : null}
            <Row label="Estimated real profit" value={gbp(job.profit)} gold />
            <Row label="Margin" value={`${Math.round(job.margin * 100)}%`} />
            <Row label="£ / mile" value={gbp(job.profitPerMile, 2)} />
            <Row label="Working time" value={hoursLabel(job.totalHours)} />
          </dl>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Why {job.score}?</h2>
          <div className="mt-4 space-y-2">
            {job.factors.map((factor) => (
              <div key={factor.key}>
                <div className="flex justify-between text-xs">
                  <span>{factor.label}</span>
                  <span className="tabular text-muted">
                    {factor.score} / {factor.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full bg-gold"
                    style={{ width: `${(factor.score / factor.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">
            Market score {job.marketScore} is quality versus today&apos;s jobs.
            Your score {job.personalScore} is fit for this vehicle, start point
            and targets.
          </p>
        </div>
      </section>
      </>
      ) : null}

      {tab === "quote" ? (
        <QuoteDecision key={job.id} job={job} book={market.jobs} profile={profile} />
      ) : null}

      {tab === "fit" ? (
      <>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Why this ranks here</h2>
          <p className="mt-3 text-sm leading-6">{intelligenceSummary(job)}</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-good">Strengths</div>
              <ul className="mt-2 space-y-1 text-sm">
                {whyStrengths(job).map((s) => (
                  <li key={s}>+ {s}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-bad">Watch</div>
              <ul className="mt-2 space-y-1 text-sm">
                {whyWeaknesses(job).map((s) => (
                  <li key={s}>− {s}</li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-4">
            <JobFlags job={job} />
          </div>
        </div>

        <div className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-sm font-medium">Four benchmarks</h2>
          <ul className="mt-3 space-y-3 text-sm">
            <li>
              <span className="text-muted">Today&apos;s jobs. </span>
              {job.profit >= market.market.medianProfit ? "Produces" : "Produces"}{" "}
              {gbp(Math.abs(job.profit - market.market.medianProfit))}{" "}
              {job.profit >= market.market.medianProfit ? "more" : "less"} than today&apos;s
              median profit of {gbp(market.market.medianProfit)}.
            </li>
            <li>
              <span className="text-muted">Work you normally take. </span>
              {vsYourNorms(job, outcomes)}
            </li>
            <li>
              <span className="text-muted">Similar work. </span>
              Among jobs of this distance band, profit/hour is{" "}
              {betterThan(job.percentiles.profitPerHour).toLowerCase()}.
            </li>
            <li>
              <span className="text-muted">Your targets. </span>
              {gbp(job.profitPerHour)}/hour is{" "}
              {job.vsTargetHour >= 0
                ? `${gbp(job.vsTargetHour)} above`
                : `${gbp(Math.abs(job.vsTargetHour))} below`}{" "}
              your {gbp(profile.targetProfitPerHour)}/hour target. Profit is{" "}
              {job.vsMinProfit >= 0
                ? `${gbp(job.vsMinProfit)} above`
                : `${gbp(Math.abs(job.vsMinProfit))} below`}{" "}
              your {gbp(profile.minProfit)} minimum.
            </li>
            <li>
              <span className="text-muted">Towards home. </span>
              Finishes {milesLabel(job.deliveryToHomeMiles)} from{" "}
              {profile.homeLocation.trim() || profile.homeCity}
              {job.towardsHomeMiles > 0
                ? `, closing ${milesLabel(job.towardsHomeMiles)} of the remaining journey.`
                : "."}
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Onward work at {job.deliveryCity}</h2>
        <p className="mt-2 text-sm capitalize text-gold">{job.onward.rating} potential</p>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <Row label="Jobs within 25 miles" value={String(job.onward.jobsWithin25)} />
          <Row label="Strong or better" value={String(job.onward.strongOrBetter)} />
          <Row label="Exceptional" value={String(job.onward.exceptional)} />
          <Row label="Average pickup" value={milesLabel(job.onward.averagePickupMiles)} />
          <Row label="Best onward profit" value={gbp(job.onward.bestOnwardProfit)} />
        </dl>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">This recommendation changes if…</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted">
          {decisionBoundary(job, rival).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Collection {job.collectionWindow}. Delivery {job.deliveryWindow}.{" "}
          {job.description}
        </p>
      </section>
      </>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  gold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  gold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className={clsx("tabular", gold && "text-gold", muted && "text-muted")}>{value}</dd>
    </div>
  );
}
