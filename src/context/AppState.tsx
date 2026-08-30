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
import { analyseMarket } from "@/lib/engine";
import { DEFAULT_PROFILE, loadProfile, saveProfile } from "@/lib/profile";
import {
  fetchConnection,
  fetchMarketplaceJobs,
  replaceMarketplaceJobs,
  setConnectionStatus,
  type MarketplaceConnection,
} from "@/lib/marketplace-store";
import { fetchRemoteProfile, upsertRemoteProfile } from "@/lib/profile-store";
import { driverFacingError, readApiJson } from "@/lib/user-error";
import type { AnalysedMarket, OperatorProfile, RawJob } from "@/lib/types";

export type ProfileSaveState = "local" | "loading" | "saving" | "saved" | "error";

const SELECTED_KEY = "tc-selected-v1";
const SAVED_KEY = "tc-saved-v1";
const DISMISSED_KEY = "tc-dismissed-v1";
const BOOK_KEY = "tc-book-v1";

export type BookSource = "demo" | "shiply";

interface AppStateValue {
  profile: OperatorProfile;
  setProfile: (next: OperatorProfile) => void;
  profileSave: ProfileSaveState;
  book: BookSource;
  setBook: (next: BookSource) => void;
  liveJobs: RawJob[];
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
}

const AppStateContext = createContext<AppStateValue | null>(null);

function readList(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
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
          };
          setProfileState(merged);
          saveProfile(merged);
          setProfileSave("saved");
          return;
        }
        await upsertRemoteProfile(user.id, profileRef.current);
        if (!cancelled) setProfileSave("saved");
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
    return () => {
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
      upsertRemoteProfile(user.id, next)
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
    if (jobs.length === 0) return;
    setLiveJobs(jobs);
    setBook("shiply");
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
    if (body.jobs?.length) acceptPulledJobs(body.jobs);
    return body.jobCount ?? body.jobs?.length ?? 0;
  };

  const persist = (key: string, ids: string[]) => {
    window.localStorage.setItem(key, JSON.stringify(ids));
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

  const market = useMemo(
    () =>
      analyseMarket(profile, liveJobs.length > 0 ? liveJobs : undefined, {
        applyPickupRadius: liveJobs.length === 0,
      }),
    [profile, liveJobs],
  );

  const value = useMemo(
    () => ({
      profile,
      setProfile,
      profileSave,
      book,
      setBook,
      liveJobs,
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
    }),
    [
      profile,
      profileSave,
      book,
      liveJobs,
      connection,
      market,
      selectedIds,
      savedIds,
      dismissedIds,
    ],
  );

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#070b10] text-sm text-[#8d99ab]">
        Loading the book…
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
