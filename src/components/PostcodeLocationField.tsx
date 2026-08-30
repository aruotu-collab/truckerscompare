"use client";

import { useEffect, useRef, useState } from "react";
import {
  locateFromBrowser,
  looksLikePostcode,
  placeFromPostcode,
} from "@/lib/uk-location";
import { clsx } from "./clsx";

export function PostcodeLocationField({
  label,
  hint,
  value,
  onChange,
  locate = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (next: { postcode: string; city?: string }) => void;
  locate?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function applyPlace(postcode: string) {
    if (!looksLikePostcode(postcode)) return;
    setBusy(true);
    setError("");
    void placeFromPostcode(postcode)
      .then((place) => {
        onChangeRef.current({
          postcode: postcode.trim().toUpperCase(),
          city: place.city,
        });
      })
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not find that postcode. Check it and try again.",
        );
      })
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    if (!looksLikePostcode(value)) return;
    const timer = window.setTimeout(() => applyPlace(value), 500);
    return () => window.clearTimeout(timer);
  }, [value]);

  function useLocation() {
    setBusy(true);
    setError("");
    void locateFromBrowser()
      .then((place) => {
        onChange({ postcode: place.outcode, city: place.city });
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
        {label}
      </span>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange({ postcode: e.target.value })}
          onBlur={(e) => applyPlace(e.target.value)}
          placeholder="SE6"
          autoComplete="postal-code"
          className="min-w-0 flex-1 rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50"
        />
        {locate ? (
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
        ) : null}
      </div>
      <span className="mt-1 block text-xs text-muted">{hint}</span>
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : null}
    </div>
  );
}
