"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAppState } from "@/context/AppState";
import {
  betterThan,
  gbp,
  hoursLabel,
  jobPath,
  loadHeadline,
  loadLabel,
  marketPriceLabel,
  milesLabel,
  routeLabel,
} from "@/lib/format";
import { JOB_SOURCES } from "@/lib/marketplaces";
import type { AnalysedJob, JobSource } from "@/lib/types";
import { clsx } from "./clsx";
import { BandPill, JobFlags, MarketplaceBids, OpenOnMarketplace, ScoreRing, SourceChip, WinnerChip } from "./ui";

type SortKey =
  | "score"
  | "profit"
  | "profitPerHour"
  | "deadMiles"
  | "totalHours"
  | "pickupMiles";

export function Opportunities() {
  const { market, selectedIds, toggleSelected, dismissedIds, savedIds } = useAppState();
  const [search, setSearch] = useState("");
  const [scoreMin, setScoreMin] = useState(0);
  const [profitMin, setProfitMin] = useState(0);
  const [hourMin, setHourMin] = useState(0);
  const [maxDead, setMaxDead] = useState(200);
  const [pickupMax, setPickupMax] = useState(200);
  const [towardsHome, setTowardsHome] = useState(false);
  const [hideDismissed, setHideDismissed] = useState(true);
  const [savedOnly, setSavedOnly] = useState(false);
  const [source, setSource] = useState<JobSource | "all">("all");
  const [sort, setSort] = useState<SortKey>("score");

  const rows = useMemo(() => {
    let list = market.jobs.filter((job) => {
      if (hideDismissed && dismissedIds.includes(job.id)) return false;
      if (savedOnly && !savedIds.includes(job.id)) return false;
      if (scoreMin > 0 && job.score < scoreMin) return false;
      if (profitMin > 0 && job.profit < profitMin) return false;
      if (hourMin > 0 && job.profitPerHour < hourMin) return false;
      if (job.deadMiles > maxDead) return false;
      if (job.pickupMiles > pickupMax) return false;
      if (towardsHome && job.towardsHomeMiles < 10) return false;
      if (source !== "all" && job.source !== source) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${job.pickupCity} ${job.deliveryCity} ${job.category} ${job.description} ${loadLabel(job)} ${job.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sort === "deadMiles" || sort === "totalHours" || sort === "pickupMiles") {
        return a[sort] - b[sort];
      }
      return b[sort] - a[sort];
    });
    return list;
  }, [
    market.jobs,
    search,
    scoreMin,
    profitMin,
    hourMin,
    maxDead,
    pickupMax,
    towardsHome,
    hideDismissed,
    savedOnly,
    source,
    sort,
    dismissedIds,
    savedIds,
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Comparison grid</p>
          <h1 className="mt-1 text-2xl font-medium">Opportunities</h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length} of {market.jobs.length} shown. Select up to four, then compare.
          </p>
        </div>
        <Link
          href={selectedIds.length ? `/compare?ids=${selectedIds.join(",")}` : "/compare"}
          className={clsx(
            "rounded-md px-3 py-2 text-sm",
            selectedIds.length
              ? "bg-gold text-ink"
              : "border border-line text-muted",
          )}
        >
          Compare selected{selectedIds.length ? ` (${selectedIds.length})` : ""}
        </Link>
      </div>

      <div className="grid gap-2 rounded-lg border border-line bg-panel p-3 md:grid-cols-4 lg:grid-cols-8">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search route or load"
          className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm outline-none focus:border-gold/50 md:col-span-2"
        />
        <NumFilter label="Score +" value={scoreMin} onChange={setScoreMin} />
        <NumFilter label="Profit £+" value={profitMin} onChange={setProfitMin} />
        <NumFilter label="£/hr +" value={hourMin} onChange={setHourMin} />
        <NumFilter label="Max dead" value={maxDead} onChange={setMaxDead} />
        <NumFilter label="Pickup <" value={pickupMax} onChange={setPickupMax} />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as JobSource | "all")}
          className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm"
        >
          <option value="all">All sources</option>
          {JOB_SOURCES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={towardsHome}
            onChange={(e) => setTowardsHome(e.target.checked)}
          />
          Towards home
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={hideDismissed}
            onChange={(e) => setHideDismissed(e.target.checked)}
          />
          Hide dismissed
        </label>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={savedOnly}
            onChange={(e) => setSavedOnly(e.target.checked)}
          />
          Saved only
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-md border border-line bg-ink px-2 py-1.5 text-sm md:col-span-2"
        >
          <option value="score">Sort: score</option>
          <option value="profit">Sort: profit</option>
          <option value="profitPerHour">Sort: £/hour</option>
          <option value="deadMiles">Sort: dead miles</option>
          <option value="totalHours">Sort: time</option>
          <option value="pickupMiles">Sort: pickup distance</option>
        </select>
      </div>

      <div className="space-y-3 md:hidden">
        {rows.slice(0, 40).map((job, index) => (
          <MobileCard
            key={job.id}
            job={job}
            rank={index + 1}
            selected={selectedIds.includes(job.id)}
            onToggle={() => toggleSelected(job.id)}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-panel-2 text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="px-3 py-2 font-medium"> </th>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Route</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Profit</th>
              <th className="px-3 py-2 font-medium">Bid</th>
              <th className="px-3 py-2 font-medium">£/hr</th>
              <th className="px-3 py-2 font-medium">Dead</th>
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Onward</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((job, index) => (
              <tr
                key={job.id}
                className="border-t border-line/80 hover:bg-panel-2/60"
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(job.id)}
                    onChange={() => toggleSelected(job.id)}
                  />
                </td>
                <td className="px-3 py-2 tabular text-muted">{index + 1}</td>
                <td className="px-3 py-2">
                  <Link href={jobPath(job.id)} className="hover:text-gold">
                    {routeLabel(job.pickupCity, job.deliveryCity)}
                  </Link>
                  <div className="mt-0.5 text-xs text-muted">{loadHeadline(job)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <SourceChip source={job.source} />
                    {job.winnerLabels.map((w) => (
                      <WinnerChip key={w} kind={w} />
                    ))}
                    <OpenOnMarketplace
                      source={job.source}
                      href={job.listingUrl}
                      className="px-2 py-0.5 text-xs"
                    />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="tabular font-medium">{job.score}</span>
                    <BandPill band={job.band} />
                  </div>
                </td>
                <td className="px-3 py-2 tabular text-gold">{gbp(job.profit)}</td>
                <td className="px-3 py-2">
                  <MarketplaceBids job={job} />
                </td>
                <td className="px-3 py-2 tabular">{gbp(job.profitPerHour)}</td>
                <td className="px-3 py-2 tabular">{milesLabel(job.deadMiles)}</td>
                <td className="px-3 py-2 tabular">{hoursLabel(job.totalHours)}</td>
                <td className="px-3 py-2 capitalize text-muted">{job.onward.rating}</td>
                <td className="px-3 py-2">
                  <SourceChip source={job.source} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NumFilter({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm tabular"
      />
    </label>
  );
}

function MobileCard({
  job,
  rank,
  selected,
  onToggle,
}: {
  job: AnalysedJob;
  rank: number;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-muted">#{rank}</div>
          <Link href={jobPath(job.id)} className="text-base font-medium">
            {routeLabel(job.pickupCity, job.deliveryCity)}
          </Link>
          <div className="mt-0.5 text-xs text-muted">{loadHeadline(job)}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <SourceChip source={job.source} />
            {job.winnerLabels.map((w) => (
              <WinnerChip key={w} kind={w} />
            ))}
          </div>
        </div>
        <ScoreRing score={job.score} band={job.band} size="sm" />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div>
          <div className="text-[11px] text-muted">Profit</div>
          <div className="tabular text-gold">{gbp(job.profit)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted">{marketPriceLabel(job)}</div>
          <MarketplaceBids job={job} />
        </div>
        <div>
          <div className="text-[11px] text-muted">Dead</div>
          <div className="tabular">{milesLabel(job.deadMiles)}</div>
        </div>
      </div>
      <div className="mt-2 text-[11px] text-muted">
        {betterThan(job.percentiles.profitPerHour)} for £/hour
      </div>
      <div className="mt-3">
        <JobFlags job={job} />
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onToggle}
          className={clsx(
            "rounded-md border px-2 py-1 text-xs",
            selected ? "border-gold text-gold" : "border-line text-muted",
          )}
        >
          {selected ? "Selected" : "Compare"}
        </button>
        <Link
          href={jobPath(job.id)}
          className="rounded-md border border-line px-2 py-1 text-xs text-muted"
        >
          Details
        </Link>
        <OpenOnMarketplace
          source={job.source}
          href={job.listingUrl}
          className="px-2 py-1 text-xs"
        />
      </div>
    </article>
  );
}
