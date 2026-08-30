import { milesLabel } from "@/lib/format";
import type { AnalysedJob, RouteLeg } from "@/lib/types";
import { clsx } from "./clsx";

type TripJob = Pick<
  AnalysedJob,
  "pickupCity" | "deliveryCity" | "pickupMiles" | "loadedMiles" | "deliveryToHomeMiles" | "legs"
>;

export function TripDiagram({
  job,
  size = "md",
  surface = "panel",
}: {
  job: TripJob;
  size?: "sm" | "md";
  surface?: "panel" | "ink";
}) {
  const trip = tripFromJob(job);
  const compact = size === "sm";

  return (
    <div
      className={clsx("w-full", compact ? "py-0.5" : "py-1")}
      style={{
        ["--trip-empty" as string]: surface === "ink" ? "var(--ink)" : "var(--panel)",
      }}
      role="img"
      aria-label={
        `Empty van ${milesLabel(trip.deadMiles)} to collect at ${trip.pickup}. ` +
        `Loaded ${milesLabel(trip.loadedMiles)} to ${trip.drop}. ` +
        `Empty ${milesLabel(trip.homeMiles)} home to ${trip.home}.`
      }
    >
      <div className="flex min-w-0 items-start overflow-x-auto">
        <Stop place={trip.start} role="Now" loaded={false} size={size} />
        <MileLine miles={trip.deadMiles} loaded={false} size={size} />
        <Stop place={trip.pickup} role="Collect" loaded size={size} />
        <MileLine miles={trip.loadedMiles} loaded size={size} />
        <Stop place={trip.drop} role="Drop" loaded size={size} />
        <MileLine miles={trip.homeMiles} loaded={false} size={size} />
        <Stop place={trip.home} role="Home" loaded={false} size={size} />
      </div>
    </div>
  );
}

function tripFromJob(job: TripJob) {
  const dead = legOf(job.legs, "deadhead");
  const load = legOf(job.legs, "loaded");
  const home = legOf(job.legs, "home");
  return {
    start: dead?.from || "Start",
    pickup: load?.from || job.pickupCity,
    drop: load?.to || job.deliveryCity,
    home: home?.to || "Home",
    deadMiles: dead?.miles ?? job.pickupMiles,
    loadedMiles: load?.miles ?? job.loadedMiles,
    homeMiles: home?.miles ?? job.deliveryToHomeMiles,
  };
}

function legOf(legs: RouteLeg[], kind: RouteLeg["kind"]) {
  return legs.find((leg) => leg.kind === kind);
}

function Stop({
  place,
  role,
  loaded,
  size,
}: {
  place: string;
  role: string;
  loaded: boolean;
  size: "sm" | "md";
}) {
  const compact = size === "sm";
  return (
    <div className={clsx("flex shrink-0 flex-col items-center", compact ? "w-16" : "w-[4.5rem]")}>
      <VanMark loaded={loaded} size={size} />
      <div
        className={clsx(
          "mt-1 w-full text-center leading-tight",
          compact ? "text-[9px] text-muted" : "text-[11px]",
        )}
        title={`${role}: ${place}`}
      >
        {place}
      </div>
      {compact ? null : (
        <div className="mt-0.5 text-[9px] uppercase tracking-wider text-muted">{role}</div>
      )}
    </div>
  );
}

function MileLine({
  miles,
  loaded,
  size,
}: {
  miles: number;
  loaded: boolean;
  size: "sm" | "md";
}) {
  const compact = size === "sm";
  return (
    <div
      className="flex min-w-6 flex-col items-center sm:min-w-8"
      style={{
        flexGrow: 10 + Math.sqrt(Math.max(miles, 0)) * 6,
        flexBasis: 0,
        paddingTop: compact ? 8 : 11,
      }}
    >
      <div
        className={clsx(
          "w-full rounded-full",
          loaded ? "h-1 bg-good" : "h-px border-t border-dashed border-muted",
        )}
      />
      <div
        className={clsx(
          "mt-1 tabular leading-none",
          compact ? "text-[9px] text-muted" : "text-[11px]",
          loaded && !compact ? "text-good" : "text-muted",
        )}
      >
        {milesLabel(miles)}
      </div>
    </div>
  );
}

function VanMark({ loaded, size }: { loaded: boolean; size: "sm" | "md" }) {
  const w = size === "sm" ? 34 : 46;
  const h = size === "sm" ? 20 : 26;
  const fill = loaded ? "var(--good)" : "var(--trip-empty, var(--panel))";
  const stroke = loaded ? "#2a9a68" : "var(--muted)";
  const glass = loaded ? "#1c6b48" : "var(--panel-2)";

  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 64 36"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect
        x="3.5"
        y="7"
        width="33"
        height="16.5"
        rx="2"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
      />
      <path
        d="M36.5 11.2h9.2c1.1 0 2.1.55 2.7 1.45L53.6 20.2v3.3H36.5V11.2z"
        fill={fill}
        stroke={stroke}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M39 13.1h6.2l3.4 5.6H39z" fill={glass} />
      <rect x="53.4" y="20.8" width="4.2" height="2.8" rx="0.6" fill={stroke} />
      <circle cx="16" cy="26.8" r="4.6" fill="#121821" stroke="var(--line)" strokeWidth="1.2" />
      <circle cx="16" cy="26.8" r="1.8" fill="var(--line)" />
      <circle cx="46.2" cy="26.8" r="4.6" fill="#121821" stroke="var(--line)" strokeWidth="1.2" />
      <circle cx="46.2" cy="26.8" r="1.8" fill="var(--line)" />
    </svg>
  );
}
