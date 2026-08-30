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
import { fetchRemoteProfile, upsertRemoteProfile } from "@/lib/profile-store";
import type { AnalysedMarket, OperatorProfile } from "@/lib/types";

export type ProfileSaveState = "local" | "loading" | "saving" | "saved" | "error";

const SELECTED_KEY = "tc-selected-v1";
const SAVED_KEY = "tc-saved-v1";
const DISMISSED_KEY = "tc-dismissed-v1";

interface AppStateValue {
  profile: OperatorProfile;
  setProfile: (next: OperatorProfile) => void;
  profileSave: ProfileSaveState;
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
  const profileRef = useRef(profile);
  const saveTimer = useRef<number | null>(null);
  profileRef.current = profile;

  useEffect(() => {
    setProfileState(loadProfile());
    setSelectedIds(readList(SELECTED_KEY));
    setSavedIds(readList(SAVED_KEY));
    setDismissedIds(readList(DISMISSED_KEY));
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
          setProfileState(remote);
          saveProfile(remote);
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
      profileSave,
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
    [profile, profileSave, market, selectedIds, savedIds, dismissedIds],
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
