"use client";

import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { dailyBrief } from "@/lib/brief";
import { followOnJobs, jobById } from "@/lib/engine";
import { jobPath, routeLabel } from "@/lib/format";
import { weekWins } from "@/lib/outcomes";

export function DailyBrief() {
  const { market, movements, outcomes, bookStale, workingJobId, startWorking } =
    useAppState();
  const brief = dailyBrief(market, movements, outcomes);
  const wins = weekWins(outcomes);
  const working = workingJobId ? jobById(market.jobs, workingJobId) : null;
  const followOns = working ? followOnJobs(market.jobs, working).slice(0, 5) : [];

  if (bookStale) return null;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-gold/25 bg-panel p-4">
        <p className="text-sm uppercase tracking-[0.22em] text-gold">Daily brief</p>
        <h2 className="mt-1 text-lg font-medium">{brief.title}</h2>
        <p className="mt-2 max-w-3xl text-base leading-6 md:text-sm">{brief.body}</p>
        <p className="mt-3 text-sm text-muted">{brief.quality}</p>
        {wins.length ? (
          <p className="mt-2 text-sm text-muted">
            This week: {wins.length} won
            {wins.length ? ` · ${wins.map((w) => w.route).slice(0, 3).join(" · ")}` : ""}
          </p>
        ) : null}
      </section>

      {working ? (
        <section className="rounded-lg border border-line bg-panel p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.22em] text-gold">Start my day</p>
              <h2 className="mt-1 text-base font-medium">
                After {routeLabel(working.pickupCity, working.deliveryCity)}
              </h2>
              <p className="mt-1 text-sm text-muted">
                Jobs that collect near {working.deliveryCity}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startWorking(null)}
              className="text-sm text-muted hover:text-text"
            >
              Clear
            </button>
          </div>
          {followOns.length === 0 ? (
            <p className="mt-3 text-sm text-muted">
              Nothing in this list collects within 30 miles of that drop.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {followOns.map((job) => (
                <li key={job.id}>
                  <Link href={jobPath(job.id)} className="text-base hover:text-gold md:text-sm">
                    {routeLabel(job.pickupCity, job.deliveryCity)}
                    <span className="ml-2 tabular text-muted">{job.score}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {movements.length > 0 ? (
        <section className="rounded-lg border border-line bg-panel p-4">
          <h2 className="text-base font-medium">What moved</h2>
          <ul className="mt-3 space-y-2">
            {movements.slice(0, 8).map((move) => (
              <li key={`${move.kind}-${move.jobId}-${move.label}`} className="text-sm">
                {move.kind === "gone" ? (
                  <span>
                    <span className="text-text">{move.label}</span>
                    <span className="mt-0.5 block text-muted">{move.detail}</span>
                  </span>
                ) : (
                  <Link href={jobPath(move.jobId)} className="hover:text-gold">
                    <span className="text-text">{move.label}</span>
                    <span className="mt-0.5 block text-muted">{move.detail}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
