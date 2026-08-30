"use client";

import { useState } from "react";
import Link from "next/link";
import { useAppState } from "@/context/AppState";
import { useAuth } from "@/context/Auth";
import { CITIES } from "@/lib/geo";
import { parseImportedListings } from "@/lib/shiply";
import { VEHICLE_LABELS } from "@/lib/profile";
import type { VehicleType } from "@/lib/types";

const EXAMPLE = `[
  {
    "externalId": "1048211",
    "listingUrl": "https://www.shiply.com/",
    "pickupCity": "Manchester",
    "deliveryCity": "Birmingham",
    "category": "Palletised goods",
    "vehicleRequired": "7.5t",
    "revenue": 420,
    "weightKg": 1400,
    "collectionWindow": "Today 14:00–18:00",
    "deliveryWindow": "Tomorrow by 12:00",
    "quoteCount": 2,
    "description": "8 pallets. Tail-lift helpful."
  }
]`;

export function ConnectShiply() {
  const { user, ready } = useAuth();
  const {
    book,
    setBook,
    liveJobs,
    connection,
    importShiplyJobs,
    disconnectShiply,
    refreshShiply,
  } = useAppState();
  const [json, setJson] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickupCity, setPickupCity] = useState("Manchester");
  const [deliveryCity, setDeliveryCity] = useState("Birmingham");
  const [revenue, setRevenue] = useState("420");
  const [listingUrl, setListingUrl] = useState("");
  const [vehicleRequired, setVehicleRequired] = useState<VehicleType>("7.5t");

  if (!ready) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (!user) {
    return (
      <div className="rounded-lg border border-line bg-panel p-5">
        <p className="text-sm">
          <Link href="/sign-in?next=/connect" className="text-gold hover:underline">
            Sign in
          </Link>{" "}
          first. Shiply jobs are saved to your account, not this browser.
        </p>
      </div>
    );
  }

  const connected = connection?.status === "connected" && liveJobs.length > 0;

  async function saveJobs(jobs: Parameters<typeof importShiplyJobs>[0]) {
    setBusy(true);
    setError("");
    try {
      await importShiplyJobs(jobs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save those jobs.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.22em] text-gold">Marketplace</p>
        <h1 className="mt-1 text-2xl font-medium">Connect Shiply</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Read and analyse only. Paste the jobs you can already see on Shiply.
          We rank them with your vehicle and costs. You still quote and accept
          on Shiply. We never store a Shiply password.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-panel p-4 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p>
              Status:{" "}
              <span className={connected ? "text-good" : "text-muted"}>
                {connected ? "Connected" : "Not connected"}
              </span>
            </p>
            <p className="mt-1 text-muted">
              {liveJobs.length} Shiply jobs saved
              {connection?.lastSyncedAt
                ? ` · last refresh ${new Date(connection.lastSyncedAt).toLocaleString("en-GB")}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {liveJobs.length > 0 ? (
              <button
                type="button"
                onClick={() => setBook(book === "shiply" ? "demo" : "shiply")}
                className="rounded-md border border-line px-3 py-1.5 text-sm"
              >
                {book === "shiply" ? "Use demo book" : "Use Shiply book"}
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              onClick={() => void refreshShiply()}
              className="rounded-md border border-line px-3 py-1.5 text-sm"
            >
              Refresh
            </button>
            {connected ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnectShiply()}
                className="rounded-md border border-line px-3 py-1.5 text-sm"
              >
                Disconnect
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <form
        className="rounded-lg border border-line bg-panel p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseImportedListings(
            JSON.stringify([
              {
                externalId: listingUrl || `${pickupCity}-${deliveryCity}-${Date.now()}`,
                listingUrl: listingUrl || undefined,
                pickupCity,
                deliveryCity,
                vehicleRequired,
                revenue: Number(revenue),
              },
            ]),
          );
          if (parsed.errors.length) {
            setError(parsed.errors.join(" "));
            return;
          }
          void saveJobs([...liveJobs.filter((job) => job.id !== parsed.jobs[0]?.id), ...parsed.jobs]);
        }}
      >
        <h2 className="text-sm font-medium">Add one listing</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
              Pickup
            </span>
            <select
              value={pickupCity}
              onChange={(e) => setPickupCity(e.target.value)}
              className={inputClass}
            >
              {CITIES.map((city) => (
                <option key={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
              Delivery
            </span>
            <select
              value={deliveryCity}
              onChange={(e) => setDeliveryCity(e.target.value)}
              className={inputClass}
            >
              {CITIES.map((city) => (
                <option key={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
              Vehicle
            </span>
            <select
              value={vehicleRequired}
              onChange={(e) => setVehicleRequired(e.target.value as VehicleType)}
              className={inputClass}
            >
              {Object.entries(VEHICLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
              Budget / quote (£)
            </span>
            <input
              type="number"
              min="1"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="text-sm md:col-span-2">
            <span className="mb-1.5 block text-[11px] uppercase tracking-wider text-muted">
              Shiply listing URL
            </span>
            <input
              type="url"
              value={listingUrl}
              onChange={(e) => setListingUrl(e.target.value)}
              placeholder="https://www.shiply.com/..."
              className={inputClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="mt-4 rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add to my book"}
        </button>
      </form>

      <div className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-sm font-medium">Import several listings</h2>
        <p className="mt-2 text-sm text-muted">
          Paste a JSON array. Unknown cities are skipped. This replaces the
          current Shiply book.
        </p>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={10}
          spellCheck={false}
          placeholder={EXAMPLE}
          className={`${inputClass} mt-3 font-mono text-xs`}
        />
        {error ? <p className="mt-3 text-sm text-bad">{error}</p> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const parsed = parseImportedListings(json);
              if (parsed.errors.length && parsed.jobs.length === 0) {
                setError(parsed.errors.join(" "));
                return;
              }
              if (parsed.errors.length) {
                setError(`${parsed.jobs.length} imported. ${parsed.errors.join(" ")}`);
              }
              void saveJobs(parsed.jobs);
            }}
            className="rounded-md bg-gold px-3 py-1.5 text-sm text-ink disabled:opacity-50"
          >
            Replace Shiply book
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1.5 text-sm"
            onClick={() => setJson(EXAMPLE)}
          >
            Show example
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm outline-none focus:border-gold/50";
