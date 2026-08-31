"use client";

import { useMemo, useState } from "react";
import {
  TARGET_MARGIN,
  breakEvenQuote,
  profitAtQuote,
  quoteLadder,
  recommendedQuote,
} from "@/lib/costs";
import { simulateOpportunity } from "@/lib/engine";
import { CITIES } from "@/lib/geo";
import { gbp, hasMarketBid, pct } from "@/lib/format";
import type { AnalysedJob, OperatorProfile } from "@/lib/types";
import { clsx } from "./clsx";

export function QuoteDecision({
  job,
  book,
  profile,
}: {
  job: AnalysedJob;
  book: AnalysedJob[];
  profile: OperatorProfile;
}) {
  const [quote, setQuote] = useState(
    Math.round(hasMarketBid(job) ? job.revenue : job.suggestedQuote),
  );
  const [fuel, setFuel] = useState(profile.fuelPricePerLitre);
  const [extraTolls, setExtraTolls] = useState(0);
  const [helperCost, setHelperCost] = useState(0);
  const [waitingMinutes, setWaitingMinutes] = useState(0);
  const [startingCity, setStartingCity] = useState(profile.startingCity);
  const [leversOpen, setLeversOpen] = useState(false);

  const scenario = {
    quote,
    fuelPricePerLitre: fuel,
    extraTolls,
    helperCost,
    waitingMinutes,
    startingCity,
  };
  const sim = simulateOpportunity(job, book, profile, scenario);
  const be = breakEvenQuote(sim.fulfilment, profile.marketplaceFeePercent);
  const suggested = recommendedQuote(sim.fulfilment, sim.hours, profile);
  const suggestedOutcome = profitAtQuote(
    sim.fulfilment,
    sim.hours,
    sim.miles,
    suggested,
    profile.marketplaceFeePercent,
  );
  const ladder = quoteLadder(sim.fulfilment, profile.marketplaceFeePercent);
  const chips = useMemo(() => {
    const values = [
      be,
      hasMarketBid(job) ? job.revenue : 0,
      suggested,
      suggested + 50,
      suggested + 100,
    ]
      .map((n) => Math.round(n))
      .filter((n) => n > 0);
    return [...new Set(values)].sort((a, b) => a - b).slice(0, 6);
  }, [be, job.revenue, suggested]);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="text-sm uppercase tracking-[0.22em] text-gold md:text-xs">Decision</p>
        <h2 className="mt-1 text-base font-medium">Quote</h2>
        <p className="mt-1 text-sm text-muted">
          Change the number you would put on Shiply. Score and rank are versus
          the other jobs here, not a win chance.
        </p>
        <label className="mt-4 block">
          <span className="text-sm uppercase tracking-wider text-muted">Your quote</span>
          <input
            type="number"
            min={0}
            step={5}
            value={quote}
            onChange={(e) => setQuote(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-md border border-line bg-ink px-3 py-2 text-lg tabular"
          />
        </label>
        <input
          type="range"
          min={Math.max(0, be - 50)}
          max={Math.max(quote, suggested, job.revenue, be) + 200}
          value={quote}
          onChange={(e) => setQuote(Number(e.target.value))}
          className="mt-3 w-full"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {chips.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setQuote(n)}
              className={clsx(
                "min-h-11 rounded-md border px-3 py-2 text-sm tabular",
                n === quote ? "border-gold text-gold" : "border-line text-muted",
              )}
            >
              {gbp(n)}
            </button>
          ))}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
          <Stat label="Revenue" value={gbp(sim.quote)} />
          <Stat label="Profit" value={gbp(sim.profit)} gold />
          <Stat label="£/hour" value={gbp(sim.profitPerHour)} />
          <Stat label="Score" value={String(sim.score)} />
          <Stat label="Rank" value={`#${sim.rank}`} />
        </dl>
        <p className="mt-2 text-sm text-muted">
          #{sim.rank} of {sim.bookSize} jobs. Margin {pct(sim.margin * 100)}.
        </p>
        <button
          type="button"
          onClick={() => setLeversOpen((open) => !open)}
          className="mt-4 text-xs text-gold"
        >
          {leversOpen ? "Hide extra levers" : "Fuel, helper, wait and start point"}
        </button>
        {leversOpen ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <NumField label="Fuel £ / litre" value={fuel} step={0.01} onChange={setFuel} />
            <NumField label="Extra tolls £" value={extraTolls} step={1} onChange={setExtraTolls} />
            <NumField label="Helper cost £" value={helperCost} step={5} onChange={setHelperCost} />
            <NumField
              label="Waiting / extra time (min)"
              value={waitingMinutes}
              step={15}
              onChange={setWaitingMinutes}
            />
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted">
                Start from
              </span>
              <select
                value={startingCity}
                onChange={(e) => setStartingCity(e.target.value)}
                className="w-full rounded-md border border-line bg-ink px-2 py-1.5 text-sm"
              >
                {CITIES.map((city) => (
                  <option key={city.name} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Before you quote</p>
        <h2 className="mt-1 text-sm font-medium">Break-even</h2>
        <p className="mt-1 text-xs text-muted">
          Cost to fulfil is fuel, running, time, tolls and helper — before the
          marketplace cut. Break-even is the quote that also covers that fee.
        </p>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Cost to fulfil" value={gbp(sim.fulfilment)} />
          <Row label="Break-even quote" value={gbp(be)} />
          <Row
            label={hasMarketBid(job) ? "Lowest current bid" : "Our lowest (no bids yet)"}
            value={gbp(hasMarketBid(job) ? job.revenue : job.suggestedQuote)}
          />
        </dl>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted">
              <th className="pb-2 text-left font-medium">If you quote</th>
              <th className="pb-2 text-right font-medium">Profit</th>
              <th className="pb-2 text-right font-medium">£/hour</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((n) => {
              const row = profitAtQuote(
                sim.fulfilment,
                sim.hours,
                sim.miles,
                n,
                profile.marketplaceFeePercent,
              );
              return (
                <tr key={n} className="border-t border-line/70">
                  <td className="py-1.5">
                    <button
                      type="button"
                      onClick={() => setQuote(n)}
                      className="tabular hover:text-gold"
                    >
                      {gbp(n)}
                    </button>
                  </td>
                  <td className={clsx("py-1.5 text-right tabular", row.profit >= 0 && "text-gold")}>
                    {gbp(row.profit)}
                  </td>
                  <td className="py-1.5 text-right tabular text-muted">
                    {gbp(row.profitPerHour)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 rounded-md border border-gold/30 bg-ink px-3 py-3">
          <div className="text-[11px] uppercase tracking-wider text-muted">
            Minimum recommended quote
          </div>
          <button
            type="button"
            onClick={() => setQuote(suggested)}
            className="mt-1 text-2xl tabular text-gold"
          >
            {gbp(suggested)}
          </button>
          <p className="mt-2 text-sm text-muted">
            Clears {gbp(suggestedOutcome.profit)} contribution, {gbp(suggestedOutcome.profitPerHour)}
            /hour, and a {Math.round(TARGET_MARGIN * 100)}% margin against your{" "}
            {gbp(profile.targetProfitPerHour)}/hour target and {gbp(profile.minProfit)} minimum
            profit.
          </p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  gold,
}: {
  label: string;
  value: string;
  gold?: boolean;
}) {
  return (
    <div>
      <div className="text-sm text-muted">{label}</div>
      <div className={clsx("mt-0.5 tabular", gold && "text-gold")}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  );
}

function NumField({
  label,
  value,
  step,
  onChange,
}: {
  label: string;
  value: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm uppercase tracking-wider text-muted">{label}</span>
      <input
        type="number"
        step={step}
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="min-h-11 w-full rounded-md border border-line bg-ink px-3 py-2 text-base tabular"
      />
    </label>
  );
}
