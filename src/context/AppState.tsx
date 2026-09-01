"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/Auth";
import { analyseMarket, getRawJobs } from "@/lib/engine";
import { isShiplyBookFresh, latestTimeMs } from "@/lib/format";
import { hydratePlaceGeos, placesForBook } from "@/lib/postcode-points";
import { DEFAULT_PROFILE, loadProfile, saveProfile } from "@/lib/profile";
import {
  fetchConnection,
  fetchMarketplaceJobs,
  replaceMarketplaceJobs,
  setConnectionStatus,
  type MarketplaceConnection,
} from "@/lib/marketplace-store";
import { fetchRemoteProfile, upsertRemoteProfile } from "@/lib/profile-store";
import { makeOutcome } from "@/lib/outcomes";
import { fetchOutcomes, insertOutcome } from "@/lib/outcomes-store";
import { bookFingerprint, diffScans, snapshotFromMarket, type ScanSnapshot } from "@/lib/scan-delta";
import { driverFacingError, readApiJson } from "@/lib/user-error";
import type {
  AnalysedJob,
  AnalysedMarket,
  JobOutcome,
  MarketMovement,
  OperatorProfile,
  OutcomeKind,
  RawJob,
} from "@/lib/types";

export type ProfileSaveState = "local" | "loading" | "saving" | "saved" | "error";

const SELECTED_KEY = "tc-selected-v1";
const SAVED_KEY = "tc-saved-v1";
const DISMISSED_KEY = "tc-dismissed-v1";
const BOOK_KEY = "tc-book-v1";
const SNAP_KEY = "tc-scan-v1";
const MOVE_KEY = "tc-moves-v1";
const OUT_KEY = "tc-outcomes-v1";
const WORK_KEY = "tc-working-v1";

export type BookSource = "demo" | "shiply";

interface AppStateValue {
  profile: OperatorProfile;
  setProfile: (next: OperatorProfile) => void;
  profileSave: ProfileSaveState;
  book: BookSource;
  setBook: (next: BookSource) => void;
  liveJobs: RawJob[];
  bookStale: boolean;
  bookPulledAt: number | null;
  connection: MarketplaceConnection | null;
  importShiplyJobs: (jobs: RawJob[]) => Promise<void>;
  disconnectShiply: () => Promise<void>;
  refreshShiply: () => Promise<void>;
  acceptPulledJobs: (jobs: RawJob[]) => void;
  syncFromShiply: () => Promise<number>;
  market: AnalysedMarket;
  selectedIds: string[];
  toggleSelected: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelected: () => void;
  savedIds: string[];
  toggleSaved: (id: string) => void;
  dismissedIds: string[];
  dismiss: (id: string) => void;
  movements: MarketMovement[];
  outcomes: JobOutcome[];
  recordOutcome: (job: AnalysedJob, kind: OutcomeKind) => void;
  workingJobId: string | null;
  startWorking: (id: string | null) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);
const EMPTY_JOBS: RawJob[] = [];

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user, ready, configured } = useAuth();
  const [profile, setProfileState] = useState<OperatorProfile>(DEFAULT_PROFILE);
  const [profileSave, setProfileSave] = useState<ProfileSaveState>("local");
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [movements, setMovements] = useState<MarketMovement[]>([]);
  const [outcomes, setOutcomes] = useState<JobOutcome[]>([]);
  const [workingJobId, setWorkingJobId] = useState<string | null>(null);
  const [geoTick, setGeoTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [book, setBookState] = useState<BookSource>("demo");
  const [liveJobs, setLiveJobs] = useState<RawJob[]>([]);
  const [connection, setConnection] = useState<MarketplaceConnection | null>(null);
  const profileRef = useRef(profile);
  const saveTimer = useRef<number | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    setProfileState(loadProfile());
    setSelectedIds(readList(SELECTED_KEY));
    setSavedIds(readList(SAVED_KEY));
    setDismissedIds(readList(DISMISSED_KEY));
    setMovements(readJson<MarketMovement[]>(MOVE_KEY, []));
    setOutcomes(readJson<JobOutcome[]>(OUT_KEY, []));
    setWorkingJobId(window.localStorage.getItem(WORK_KEY));
    const storedBook = window.localStorage.getItem(BOOK_KEY);
    if (storedBook === "demo" || storedBook === "shiply") setBookState(storedBook);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!ready || !hydrated) return;
    if (!configured || !user) {
      setProfileSave("local");
      return;
    }

    let cancelled = false;
    setProfileSave("loading");
    fetchRemoteProfile(user.id)
      .then(async (remote) => {
        if (cancelled) return;
        if (remote) {
          const merged = {
            ...remote,
            searchLocation: remote.searchLocation || profileRef.current.searchLocation,
            homeLocation: remote.homeLocation || profileRef.current.homeLocation,
          };
          setProfileState(merged);
          saveProfile(merged);
          setProfileSave("saved");
          return;
        }
        await upsertRemoteProfile(user.id, profileRef.current, user.email);
        if (!cancelled) setProfileSave("saved");
      })
      .then(async () => {
        if (cancelled) return;
        try {
          const remoteOutcomes = await fetchOutcomes(user.id);
          if (!cancelled && remoteOutcomes.length) {
            setOutcomes(remoteOutcomes);
            window.localStorage.setItem(OUT_KEY, JSON.stringify(remoteOutcomes));
          }
        } catch {
          // Table may not exist yet — local outcomes still work.
        }
      })
      .catch(() => {
        if (!cancelled) setProfileSave("error");
      });

    return () => {
      cancelled = true;
    };
  }, [ready, hydrated, configured, user?.id]);

  useEffect(() => {
    if (!ready || !hydrated || !configured || !user) {
      setLiveJobs([]);
      setConnection(null);
      return;
    }
    let cancelled = false;
    Promise.all([fetchConnection(user.id), fetchMarketplaceJobs(user.id)])
      .then(([nextConnection, jobs]) => {
        if (cancelled) return;
        setConnection(nextConnection);
        setLiveJobs(jobs);
        if (jobs.length > 0 && nextConnection?.status === "connected") {
          setBookState("shiply");
          window.localStorage.setItem(BOOK_KEY, "shiply");
        }
      })
      .catch(() => {
        if (!cancelled) setConnection(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, hydrated, configured, user?.id]);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearInterval(tick);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, []);

  const setProfile = (next: OperatorProfile) => {
    setProfileState(next);
    saveProfile(next);
    if (!user) {
      setProfileSave("local");
      return;
    }
    setProfileSave("saving");
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      upsertRemoteProfile(user.id, next, user.email)
        .then(() => setProfileSave("saved"))
        .catch(() => setProfileSave("error"));
    }, 600);
  };

  const setBook = (next: BookSource) => {
    setBookState(next);
    window.localStorage.setItem(BOOK_KEY, next);
  };

  const importShiplyJobs = async (jobs: RawJob[]) => {
    if (!user) throw new Error("Sign in to save a Shiply book.");
    await replaceMarketplaceJobs(user.id, jobs);
    setLiveJobs(jobs);
    setConnection({
      source: "Shiply",
      status: jobs.length > 0 ? "connected" : "disconnected",
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      jobCount: jobs.length,
      hasContext: connection?.hasContext ?? false,
    });
    if (jobs.length > 0) setBook("shiply");
  };

  const disconnectShiply = async () => {
    if (user) await setConnectionStatus(user.id, "disconnected");
    setConnection((prev) =>
      prev ? { ...prev, status: "disconnected" } : prev,
    );
    setBook("demo");
  };

  const refreshShiply = async () => {
    if (!user) return;
    const [nextConnection, jobs] = await Promise.all([
      fetchConnection(user.id),
      fetchMarketplaceJobs(user.id),
    ]);
    setConnection(nextConnection);
    setLiveJobs(jobs);
    if (jobs.length > 0) setBook("shiply");
  };

  const acceptPulledJobs = (jobs: RawJob[]) => {
    setLiveJobs(jobs);
    setConnection((prev) =>
      prev
        ? {
            ...prev,
            lastSyncedAt: new Date().toISOString(),
            jobCount: jobs.length,
            lastError: null,
            status: jobs.length > 0 ? "connected" : prev.status,
          }
        : prev,
    );
    if (jobs.length > 0) setBook("shiply");
  };

  const syncFromShiply = async () => {
    const res = await fetch("/api/shiply/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startingCity: profile.startingCity,
        searchLocation: profile.searchLocation,
        radiusMiles: profile.maxDeadMiles,
      }),
    });
    const body = await readApiJson<{
      error?: string;
      jobCount?: number;
      jobs?: RawJob[];
    }>(res);
    if (!res.ok) {
      throw new Error(
        driverFacingError(body.error, "Could not refresh Shiply."),
      );
    }
        await refreshShiply();
    acceptPulledJobs(body.jobs ?? []);
    return body.jobCount ?? body.jobs?.length ?? 0;
  };

  const persist = (key: string, value: unknown) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4
          ? [...prev.slice(1), id]
          : [...prev, id];
      persist(SELECTED_KEY, next);
      return next;
    });
  };

  const selectMany = (ids: string[]) => {
    const next = [...new Set(ids)].slice(0, 4);
    setSelectedIds(next);
    persist(SELECTED_KEY, next);
  };

  const clearSelected = () => {
    setSelectedIds([]);
    persist(SELECTED_KEY, []);
  };

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      persist(SAVED_KEY, next);
      return next;
    });
  };

  const dismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      persist(DISMISSED_KEY, next);
      return next;
    });
    setSelectedIds((prev) => {
      const next = prev.filter((x) => x !== id);
      persist(SELECTED_KEY, next);
      return next;
    });
  };

  const recordOutcome = (job: AnalysedJob, kind: OutcomeKind) => {
    const nextItem = makeOutcome(job, kind);
    setOutcomes((prev) => {
      const next = [nextItem, ...prev.filter((o) => o.jobId !== job.id)].slice(0, 80);
      persist(OUT_KEY, next);
      return next;
    });
    if (user) {
      void insertOutcome(user.id, nextItem).catch(() => undefined);
    }
  };

  const startWorking = (id: string | null) => {
    setWorkingJobId(id);
    if (id) window.localStorage.setItem(WORK_KEY, id);
    else window.localStorage.removeItem(WORK_KEY);
  };

  useEffect(() => {
    if (!hydrated) return;
    const jobs = liveJobs.length > 0 ? liveJobs : getRawJobs();
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void hydratePlaceGeos(placesForBook(profile, jobs)).then((changed) => {
        if (!cancelled && changed) setGeoTick((n) => n + 1);
      });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    hydrated,
    liveJobs,
    profile.searchLocation,
    profile.homeLocation,
    profile.startingCity,
    profile.homeCity,
  ]);

  const bookPulledAt = latestTimeMs(
    connection?.lastSyncedAt,
    ...liveJobs.map((job) => job.updatedAt),
  );
  const bookStale =
    book === "shiply" &&
    liveJobs.length > 0 &&
    bookPulledAt != null &&
    !isShiplyBookFresh(bookPulledAt, now);
  const shiplyJobs = book === "shiply" && !bookStale ? liveJobs : EMPTY_JOBS;

  const market = useMemo(
    () =>
      analyseMarket(
        profile,
        book === "shiply" ? shiplyJobs : undefined,
        { applyPickupRadius: book !== "shiply" },
      ),
    [profile, book, shiplyJobs, geoTick],
  );

  useEffect(() => {
    if (!hydrated) return;
    const fingerprint = bookFingerprint(
      book === "shiply" ? shiplyJobs : market.jobs,
    );
    const prev = readJson<ScanSnapshot | null>(SNAP_KEY, null);
    if (prev?.fingerprint === fingerprint) return;
    const next = snapshotFromMarket(market);
    if (prev) {
      const moves = diffScans(prev, next, savedIds);
      setMovements(moves);
      persist(MOVE_KEY, moves);
    }
    window.localStorage.setItem(SNAP_KEY, JSON.stringify(next));
  }, [hydrated, book, shiplyJobs, market, savedIds]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      profileSave,
      book,
      setBook,
      liveJobs,
      bookStale,
      bookPulledAt,
      connection,
      importShiplyJobs,
      disconnectShiply,
      refreshShiply,
      acceptPulledJobs,
      syncFromShiply,
      market,
      selectedIds,
      toggleSelected,
      selectMany,
      clearSelected,
      savedIds,
      toggleSaved,
      dismissedIds,
      dismiss,
      movements,
      outcomes,
      recordOutcome,
      workingJobId,
      startWorking,
    }),
    [
      profile,
      profileSave,
      book,
      liveJobs,
      bookStale,
      bookPulledAt,
      connection,
      market,
      selectedIds,
      savedIds,
      dismissedIds,
      movements,
      outcomes,
      workingJobId,
      user,
    ],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b10] text-sm text-[#8d99ab]">
        Loading jobs…
      </div>
    );
  }

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
