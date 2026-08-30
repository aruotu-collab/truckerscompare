"use client";

import { useState } from "react";
import { locateFromBrowser } from "@/lib/uk-location";
import { clsx } from "./clsx";

export function PostcodeLocationField({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: { searchLocation: string; startingCity?: string }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function useLocation() {
    setBusy(true);
    setError("");
    void locateFromBrowser()
      .then((place) => {
        onChange({
          searchLocation: place.outcode,
          startingCity: place.startingCity,
        });
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not read your location. Type your postcode instead.",
        );
      })
      .finally(() => setBusy(false));
  }

  return (
    <div>
      <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
        Where you are now — postcode
      </span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange({ searchLocation: e.target.value })}
          placeholder="SE6"
          autoComplete="postal-code"
          className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50"
        />
        <button
          type="button"
          disabled={busy}
          onClick={useLocation}
          className={clsx(
            "shrink-0 rounded-md border border-line px-3 py-2 text-sm",
            busy ? "opacity-50" : "hover:border-gold/40 hover:text-text",
          )}
        >
          {busy ? "Finding…" : "Use my location"}
        </button>
      </div>
      <span className="mt-1 block text-xs text-muted">
        Enter this to find more listings around you. A postcode such as SE6 is
        also your starting location. A city name like London finds almost
        nothing.
      </span>
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : null}
    </div>
  );
}
