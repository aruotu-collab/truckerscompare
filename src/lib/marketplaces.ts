import type { JobSource } from "./types";

type Marketplace = {
  label: string;
  kind: "quotes" | "listing";
  chip: string;
};

export const MARKETPLACES: { [K in JobSource]: Marketplace } = {
  Shiply: {
    label: "Shiply",
    kind: "quotes",
    chip: "border-gold/35 bg-gold/15 text-gold",
  },
  uShip: {
    label: "uShip",
    kind: "quotes",
    chip: "border-info/35 bg-info/15 text-info",
  },
  "Courier Exchange": {
    label: "Courier Exchange",
    kind: "listing",
    chip: "border-good/35 bg-good/15 text-good",
  },
  Returnloads: {
    label: "Returnloads",
    kind: "listing",
    chip: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  },
  "Man and Van": {
    label: "Man and Van",
    kind: "quotes",
    chip: "border-violet-400/35 bg-violet-400/15 text-violet-300",
  },
};

export const JOB_SOURCES = Object.keys(MARKETPLACES) as JobSource[];

export function sourceLabel(source: JobSource): string {
  return MARKETPLACES[source].label;
}

export function marketplaceKind(source: JobSource): Marketplace["kind"] {
  return MARKETPLACES[source].kind;
}

export function sourceChipClass(source: JobSource): string {
  return MARKETPLACES[source].chip;
}
