import type { ReactNode } from "react";
import type { AnalysedJob, JobSource, ScoreBand, WinnerKind } from "@/lib/types";
import { bandLabel, gbp, winnerLabel } from "@/lib/format";
import { clsx } from "./clsx";

export function OpenOnMarketplace({
  source,
  href,
  className,
}: {
  source: JobSource;
  href?: string | null;
  className?: string;
}) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        "rounded-md bg-gold px-3 py-1.5 text-sm text-ink hover:opacity-90",
        className,
      )}
    >
      View on {source}
    </a>
  );
}

export function ScoreRing({
  score,
  band,
  size = "md",
}: {
  score: number;
  band: ScoreBand;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? 72 : size === "sm" ? 40 : 52;
  const stroke = size === "sm" ? 4 : 5;
  const r = (dim - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color =
    band === "exceptional"
      ? "var(--gold)"
      : band === "strong"
        ? "var(--good)"
        : band === "average"
          ? "var(--info)"
          : band === "weak"
            ? "#c9843a"
            : "var(--bad)";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="#243044"
          strokeWidth={stroke}
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={clsx(
          "absolute tabular font-medium",
          size === "lg" ? "text-lg" : size === "sm" ? "text-[11px]" : "text-sm",
        )}
      >
        {score}
      </span>
    </div>
  );
}

export function BandPill({ band }: { band: ScoreBand }) {
  const tone =
    band === "exceptional"
      ? "text-gold border-gold/30 bg-gold/10"
      : band === "strong"
        ? "text-good border-good/30 bg-good/10"
        : band === "average"
          ? "text-info border-info/30 bg-info/10"
          : band === "weak"
            ? "text-amber-400 border-amber-400/25 bg-amber-400/10"
            : "text-bad border-bad/30 bg-bad/10";
  return (
    <span className={clsx("rounded-full border px-2 py-0.5 text-[11px] tracking-wide uppercase", tone)}>
      {bandLabel(band)}
    </span>
  );
}

export function WinnerChip({ kind }: { kind: WinnerKind }) {
  return (
    <span className="rounded-sm bg-gold/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-gold">
      {winnerLabel(kind)}
    </span>
  );
}

export function Money({
  value,
  digits = 0,
  className,
}: {
  value: number;
  digits?: number;
  className?: string;
}) {
  return <span className={clsx("tabular", className)}>{gbp(value, digits)}</span>;
}

export function Metric({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-1 text-base tabular">{children}</div>
      {hint ? <div className="mt-0.5 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export function JobFlags({ job }: { job: AnalysedJob }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {job.flags.map((flag) => (
        <span
          key={flag.label}
          className={clsx(
            "rounded-sm px-1.5 py-0.5 text-[11px]",
            flag.kind === "strength"
              ? "bg-good/10 text-good"
              : "bg-bad/10 text-bad",
          )}
        >
          {flag.kind === "strength" ? "▲" : "▼"} {flag.label}
        </span>
      ))}
    </div>
  );
}
