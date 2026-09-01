"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/Auth";
import { isAdminEmail } from "@/lib/admin";
import { clsx } from "./clsx";

type Tab = "traffic" | "clicks" | "users" | "connect" | "interest" | "outcomes";

type EventRow = {
  id: string;
  created_at: string;
  kind: "page" | "click";
  path: string;
  href: string | null;
  label: string | null;
  referrer: string | null;
  ip: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  user_id: string | null;
  session_id: string | null;
};

type AdminData = {
  me: string;
  totals: {
    users: number;
    connections: number;
    jobs: number;
    interest: number;
    outcomes: number;
    eventsToday: number;
    eventsShown: number;
  };
  users: {
    id: string;
    display_name: string | null;
    email: string | null;
    home_city: string | null;
    starting_city: string | null;
    search_location: string | null;
    vehicle_type: string | null;
    updated_at: string;
  }[];
  connections: {
    user_id: string;
    source: string;
    status: string;
    last_synced_at: string | null;
    job_count: number;
    last_error: string | null;
  }[];
  interest: { user_id: string; source: string; created_at: string }[];
  outcomes: {
    user_id: string;
    kind: string;
    route: string;
    profit: number | string | null;
    recorded_at: string;
  }[];
  traffic: {
    pages: { key: string; count: number }[];
    referrers: { key: string; count: number }[];
    ips: { key: string; count: number }[];
    cities: { key: string; count: number }[];
    clicks: { key: string; count: number }[];
  };
  events: EventRow[];
};

const TABS: { id: Tab; label: string }[] = [
  { id: "traffic", label: "Traffic" },
  { id: "clicks", label: "Clicks" },
  { id: "users", label: "Users" },
  { id: "connect", label: "Connections" },
  { id: "interest", label: "Waitlist" },
  { id: "outcomes", label: "Outcomes" },
];

function when(value: string | null | undefined): string {
  if (!value) return "—";
  const at = Date.parse(value);
  if (!Number.isFinite(at)) return value;
  return new Date(at).toLocaleString("en-GB");
}

function place(row: Pick<EventRow, "city" | "region" | "country">): string {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "—";
}

function RankList({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; count: number }[];
}) {
  return (
    <article className="rounded-lg border border-line bg-panel p-4">
      <h3 className="text-sm font-medium">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing yet.</p>
      ) : (
        <ol className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <li key={row.key} className="flex justify-between gap-3">
              <span className="min-w-0 break-all text-muted">{row.key}</span>
              <span className="tabular text-text">{row.count}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}

export function AdminConsole() {
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<Tab>("traffic");
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function load() {
    setBusy(true);
    setError("");
    void fetch("/api/admin/overview")
      .then(async (res) => {
        const body = (await res.json()) as AdminData & { error?: string };
        if (!res.ok) throw new Error(body.error || "Could not load admin.");
        setData(body);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Could not load admin."),
      )
      .finally(() => setBusy(false));
  }

  useEffect(() => {
    if (!ready) return;
    if (!isAdminEmail(user?.email)) return;
    load();
  }, [ready, user?.email]);

  if (!ready) {
    return <p className="text-sm text-muted">Checking your session…</p>;
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-medium">Admin</h1>
        <p className="text-sm text-muted">
          <Link href="/sign-in?next=/admin" className="text-gold hover:underline">
            Sign in
          </Link>{" "}
          with the admin account.
        </p>
      </div>
    );
  }

  if (!isAdminEmail(user.email)) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-medium">Admin</h1>
        <p className="text-sm text-muted">This page is only for the site owner.</p>
      </div>
    );
  }

  const clicks = (data?.events ?? []).filter((row) => row.kind === "click");

  return (
    <div className="space-y-5" data-admin-ignore>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold">Owner</p>
          <h1 className="mt-1 text-2xl font-medium">Admin</h1>
          <p className="mt-1 text-sm text-muted">
            {user.email}. Page views, clicks, IPs and driver accounts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={load}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-sm"
          >
            {busy ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm("Delete click and page logs older than 30 days?")) return;
              void fetch("/api/admin/purge", { method: "POST" })
                .then(() => load())
                .catch(() => undefined);
            }}
            className="min-h-11 rounded-md border border-line px-3 py-2 text-sm text-muted"
          >
            Clear logs 30d+
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-warn">{error}</p> : null}

      {data ? (
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Users", data.totals.users],
            ["Connections", data.totals.connections],
            ["Jobs saved", data.totals.jobs],
            ["Waitlist", data.totals.interest],
            ["Outcomes", data.totals.outcomes],
            ["Hits today", data.totals.eventsToday],
          ].map(([label, value]) => (
            <article key={label} className="rounded-lg border border-line bg-panel p-3">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
              <p className="mt-1 text-2xl tabular">{value}</p>
            </article>
          ))}
        </div>
      ) : null}

      <nav className="shell-nav -mx-4 flex gap-1 overflow-x-auto px-4 md:-mx-0 md:px-0">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={clsx(
              "inline-flex min-h-11 shrink-0 items-center rounded-md px-3 text-sm",
              tab === item.id ? "bg-panel-2 text-gold" : "text-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {!data ? (
        <p className="text-sm text-muted">{busy ? "Loading the books…" : "No admin data yet."}</p>
      ) : tab === "traffic" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <RankList title="Pages" rows={data.traffic.pages} />
          <RankList title="Referrers" rows={data.traffic.referrers} />
          <RankList title="IP addresses" rows={data.traffic.ips} />
          <RankList title="Cities" rows={data.traffic.cities} />
        </div>
      ) : tab === "clicks" ? (
        <div className="space-y-3">
          <RankList title="What they click" rows={data.traffic.clicks} />
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="min-w-[70rem] w-full text-left text-sm">
              <thead className="bg-panel text-xs uppercase tracking-[0.14em] text-muted">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Page</th>
                  <th className="px-3 py-2">Clicked</th>
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Where</th>
                  <th className="px-3 py-2">From</th>
                </tr>
              </thead>
              <tbody>
                {clicks.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    <td className="px-3 py-2 whitespace-nowrap">{when(row.created_at)}</td>
                    <td className="px-3 py-2">{row.path}</td>
                    <td className="px-3 py-2">
                      {row.label || "—"}
                      {row.href ? <span className="block text-muted">{row.href}</span> : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{row.ip || "—"}</td>
                    <td className="px-3 py-2">{place(row)}</td>
                    <td className="px-3 py-2 break-all text-muted">{row.referrer || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {clicks.length === 0 ? (
              <p className="p-3 text-sm text-muted">No clicks logged yet. Open the site after you run the SQL.</p>
            ) : null}
          </div>
        </div>
      ) : tab === "users" ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-[56rem] w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Search</th>
                <th className="px-3 py-2">Home</th>
                <th className="px-3 py-2">Vehicle</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((row) => (
                <tr key={row.id} className="border-t border-line">
                  <td className="px-3 py-2">{row.email || row.id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{row.display_name || "—"}</td>
                  <td className="px-3 py-2">
                    {row.search_location || row.starting_city || "—"}
                  </td>
                  <td className="px-3 py-2">{row.home_city || "—"}</td>
                  <td className="px-3 py-2">{row.vehicle_type || "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(row.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "connect" ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-[56rem] w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Board</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Jobs</th>
                <th className="px-3 py-2">Last pull</th>
                <th className="px-3 py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {data.connections.map((row) => (
                <tr key={`${row.user_id}-${row.source}`} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2 tabular">{row.job_count}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(row.last_synced_at)}</td>
                  <td className="px-3 py-2 text-warn">{row.last_error || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : tab === "interest" ? (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-[36rem] w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Board</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {data.interest.map((row) => (
                <tr key={`${row.user_id}-${row.source}`} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td>
                  <td className="px-3 py-2">{row.source}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{when(row.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="min-w-[48rem] w-full text-left text-sm">
            <thead className="bg-panel text-xs uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-3 py-2">When</th>
                <th className="px-3 py-2">Kind</th>
                <th className="px-3 py-2">Route</th>
                <th className="px-3 py-2">Profit</th>
                <th className="px-3 py-2">User</th>
              </tr>
            </thead>
            <tbody>
              {data.outcomes.map((row, i) => (
                <tr key={`${row.user_id}-${row.recorded_at}-${i}`} className="border-t border-line">
                  <td className="px-3 py-2 whitespace-nowrap">{when(row.recorded_at)}</td>
                  <td className="px-3 py-2">{row.kind}</td>
                  <td className="px-3 py-2">{row.route}</td>
                  <td className="px-3 py-2 tabular">{row.profit ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.user_id.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
