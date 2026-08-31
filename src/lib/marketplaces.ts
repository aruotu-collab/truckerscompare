import type { JobSource } from "./types";

export type ConnectStatus = "live" | "waitlist" | "later";

type Marketplace = {
  label: string;
  kind: "quotes" | "listing";
  chip: string;
  status: ConnectStatus;
  region: string;
  typical: string;
};

export const MARKETPLACES: { [K in JobSource]: Marketplace } = {
  Shiply: {
    label: "Shiply",
    kind: "quotes",
    chip: "border-gold/35 bg-gold/15 text-gold",
    status: "live",
    region: "UK, Europe, US",
    typical: "Cars, furniture, motorcycles, removals",
  },
  uShip: {
    label: "uShip",
    kind: "quotes",
    chip: "border-info/35 bg-info/15 text-info",
    status: "waitlist",
    region: "UK, US, international",
    typical: "Vehicles, furniture, freight",
  },
  AnyVan: {
    label: "AnyVan",
    kind: "quotes",
    chip: "border-sky-400/35 bg-sky-400/15 text-sky-300",
    status: "waitlist",
    region: "UK",
    typical: "Furniture, removals, vehicles",
  },
  Clicktrans: {
    label: "Clicktrans",
    kind: "quotes",
    chip: "border-teal-400/35 bg-teal-400/15 text-teal-300",
    status: "waitlist",
    region: "UK and Europe",
    typical: "Cars, furniture, pallets, motorcycles",
  },
  "Courier Exchange": {
    label: "Courier Exchange",
    kind: "listing",
    chip: "border-good/35 bg-good/15 text-good",
    status: "later",
    region: "UK",
    typical: "Courier and return-load listings",
  },
  Returnloads: {
    label: "Returnloads",
    kind: "listing",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    status: "later",
    region: "UK",
    typical: "Return loads",
  },
  "Man and Van": {
    label: "Man and Van",
    kind: "quotes",
    chip: "border-violet-400/35 bg-violet-400/15 text-violet-300",
    status: "later",
    region: "UK",
    typical: "Furniture, house moves, man-and-van",
  },
};

export const JOB_SOURCES = Object.keys(MARKETPLACES) as JobSource[];

export const CONNECT_LIVE = JOB_SOURCES.filter((s) => MARKETPLACES[s].status === "live");
export const CONNECT_WAITLIST = JOB_SOURCES.filter((s) => MARKETPLACES[s].status === "waitlist");
export const CONNECT_LATER = JOB_SOURCES.filter((s) => MARKETPLACES[s].status === "later");

export function sourceLabel(source: JobSource): string {
  return MARKETPLACES[source].label;
}

export function marketplaceKind(source: JobSource): Marketplace["kind"] {
  return MARKETPLACES[source].kind;
}

export function sourceChipClass(source: JobSource): string {
  return MARKETPLACES[source].chip;
}

export function marketplaceMeta(source: JobSource): Marketplace {
  return MARKETPLACES[source];
}
