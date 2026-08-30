"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { analyseMarket } from "@/lib/engine";
import { DEFAULT_PROFILE, loadProfile, saveProfile } from "@/lib/profile";
import type { AnalysedMarket, OperatorProfile } from "@/lib/types";

const SELECTED_KEY = "tc-selected-v1";
const SAVED_KEY = "tc-saved-v1";
const DISMISSED_KEY = "tc-dismissed-v1";

interface AppStateValue {
  profile: OperatorProfile;
  setProfile: (next: OperatorProfile) => void;
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
  const [profile, setProfileState] = useState<OperatorProfile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  useEffect(() => {
    setProfileState(loadProfile());
    setSelectedIds(readList(SELECTED_KEY));
    setSavedIds(readList(SAVED_KEY));
    setDismissedIds(readList(DISMISSED_KEY));
    setHydrated(true);
  }, []);

  const setProfile = (next: OperatorProfile) => {
    setProfileState(next);
    saveProfile(next);
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

  const market = useMemo(() => analyseMarket(profile), [profile]);

  const value = useMemo(
    () => ({
      profile,
      setProfile,
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
    [profile, market, selectedIds, savedIds, dismissedIds],
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
