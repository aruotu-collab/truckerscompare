"use client";

import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { jobById } from "@/lib/engine";
import { combinationWhy } from "@/lib/explanations";
import {
  betterThan,
  gbp,
  highestBidOf,
  hoursLabel,
  jobPath,
  loadHeadline,
  marketPriceLabel,
  milesLabel,
  routeLabel,
  winnerLabel,
} from "@/lib/format";
import type { AnalysedJob, CombinationPlan, WinnerKind } from "@/lib/types";
import { BandPill, MarketplaceBids, Money, OpenOnMarketplace, ScoreRing, SourceChip, WinnerChip } from "./ui";

export function Overview() {
  const { market } = useAppState();
  const { winners, market: summary, actNow, consider, combinations } = market;
  const comboA = winners.bestCombination
    ? jobById(market.jobs, winners.bestCombination.jobAId)
    : null;
  const comboSingle = winners.highestProfit;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Today&apos;s market</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">
          {summary.analysed} opportunities analysed
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          You are in {summary.startingCity}. Home is {summary.homeCity}. The
          book is {summary.qualityLabel.toLowerCase()}. Miles and times are UK
          road distances, not crow-flies. Do not read 100 rows — start with the
          winners, then inspect the evidence.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {(
          [
            ["Exceptional", summary.bands.exceptional],
            ["Strong", summary.bands.strong],
            ["Average", summary.bands.average],
            ["Weak", summary.bands.weak],
            ["Poor", summary.bands.poor],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="rounded-lg border border-line bg-panel px-3 py-3">
            <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
            <div className="mt-1 text-2xl tabular">{n}</div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-lg font-medium">Today&apos;s winners</h2>
          <p className="hidden text-xs text-muted md:block">
            Different jobs win for different reasons
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <WinnerJobCard kind="best_overall" job={winners.bestOverall} />
          <WinnerJobCard kind="highest_profit" job={winners.highestProfit} />
          <WinnerJobCard kind="best_per_hour" job={winners.bestPerHour} />
          <WinnerJobCard kind="lowest_dead" job={winners.lowestDead} />
          <WinnerJobCard kind="towards_home" job={winners.towardsHome} />
          <WinnerComboCard plan={winners.bestCombination} why={combinationWhy(winners.bestCombination ?? dummyPlan(), comboSingle)} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Bucket title="Act now" jobs={actNow} empty="Nothing at this bar yet." />
        <Bucket title="Worth considering" jobs={consider} empty="No mid-tier jobs after filters." />
        <div className="rounded-lg border border-line bg-panel p-4">
          <h3 className="text-sm font-medium">Ignore</h3>
          <p className="mt-2 text-3xl tabular text-muted">{market.ignoreCount}</p>
          <p className="mt-2 text-sm text-muted">
            Remaining jobs are average or worse for this vehicle and starting
            point. Open the grid only if you want to hunt edge cases.
          </p>
          <Link
            href="/opportunities"
            className="mt-4 inline-block text-sm text-gold hover:underline"
          >
            Open full comparison grid
          </Link>
        </div>
      </section>

      {combinations[0] && comboA ? (
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-lg font-medium">Best two-job day</h2>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            {combinationWhy(combinations[0], winners.bestOverall)}
          </p>
        </section>
      ) : null}
    </div>
  );
}

function WinnerJobCard({
  kind,
  job,
}: {
  kind: WinnerKind;
  job: AnalysedJob | null;
}) {
  if (!job) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
        No {winnerLabel(kind).toLowerCase()} in this book.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-line bg-panel p-4 transition-colors hover:border-gold/40">
      <Link href={jobPath(job.id)} className="block">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <WinnerChip kind={kind} />
              <SourceChip source={job.source} />
            </div>
            <div className="mt-2 text-base font-medium">
              {routeLabel(job.pickupCity, job.deliveryCity)}
            </div>
            <div className="mt-1 text-sm">{loadHeadline(job)}</div>
            <div className="mt-1 text-xs text-muted">{job.category}</div>
          </div>
          <ScoreRing score={job.score} band={job.band} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div>
            <div className="text-[11px] text-muted">Profit</div>
            <Money value={job.profit} className="text-gold" />
          </div>
          <div>
            <div className="text-[11px] text-muted">£/hour</div>
            <span className="tabular">{gbp(job.profitPerHour)}</span>
          </div>
          <div>
            <div className="text-[11px] text-muted">Dead</div>
            <span className="tabular">{milesLabel(job.deadMiles)}</span>
          </div>
          <div>
            <div className="text-[11px] text-muted">{marketPriceLabel(job.source)}</div>
            <MarketplaceBids job={job} />
          </div>
        </div>
        <div className="mt-3 text-[11px] text-muted">
          {kind === "towards_home"
            ? `Closes ${milesLabel(job.towardsHomeMiles)} of the journey home`
            : betterThan(job.percentiles.personalScore)}
        </div>
      </Link>
      <div className="mt-3 flex flex-wrap gap-2">
        <OpenOnMarketplace source={job.source} href={job.listingUrl} />
        <Link
          href={jobPath(job.id)}
          className="rounded-md border border-line px-3 py-1.5 text-sm"
        >
          Our analysis
        </Link>
      </div>
    </div>
  );
}

function WinnerComboCard({
  plan,
  why,
}: {
  plan: CombinationPlan | null;
  why: string;
}) {
  if (!plan) {
    return (
      <div className="rounded-lg border border-line bg-panel p-4 text-sm text-muted">
        No compatible two-job chain in this book.
      </div>
    );
  }
  return (
    <Link
      href={`/compare?ids=${plan.jobAId},${plan.jobBId}`}
      className="block rounded-lg border border-gold/25 bg-panel p-4 hover:border-gold/50"
    >
      <WinnerChip kind="best_combination" />
      <div className="mt-2 text-base font-medium">{plan.label}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-[11px] text-muted">Profit</div>
          <span className="tabular text-gold">{gbp(plan.profit)}</span>
        </div>
        <div>
          <div className="text-[11px] text-muted">£/hour</div>
          <span className="tabular">{gbp(plan.profitPerHour)}</span>
        </div>
        <div>
          <div className="text-[11px] text-muted">Time</div>
          <span className="tabular">{hoursLabel(plan.hours)}</span>
        </div>
      </div>
      <p className="mt-3 line-clamp-3 text-[11px] text-muted">{why}</p>
    </Link>
  );
}

function Bucket({
  title,
  jobs,
  empty,
}: {
  title: string;
  jobs: AnalysedJob[];
  empty: string;
}) {
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {jobs.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <div>
                <Link href={jobPath(job.id)} className="block hover:text-gold">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {routeLabel(job.pickupCity, job.deliveryCity)}
                    </span>
                    <span className="tabular text-sm text-muted">{job.score}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{loadHeadline(job)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                    <SourceChip source={job.source} />
                    <BandPill band={job.band} />
                    <span className="tabular">{gbp(job.profit)} profit</span>
                    <span className="tabular">
                      {marketPriceLabel(job.source)} {gbp(job.revenue)}
                      {highestBidOf(job) ? ` · Highest ${gbp(highestBidOf(job)!)}` : ""}
                    </span>
                  </div>
                </Link>
                <OpenOnMarketplace
                  source={job.source}
                  href={job.listingUrl}
                  className="mt-2 inline-block px-2 py-1 text-xs"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function dummyPlan(): CombinationPlan {
  return {
    id: "",
    jobAId: "",
    jobBId: "",
    label: "",
    gapMiles: 0,
    revenue: 0,
    costs: 0,
    profit: 0,
    hours: 0,
    profitPerHour: 0,
    deadMiles: 0,
    finishCity: "",
    finishToHomeMiles: 0,
    score: 0,
  };
}
