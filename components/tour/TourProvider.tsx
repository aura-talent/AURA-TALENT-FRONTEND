"use client";

import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { profileApi } from "@/lib/profileApi";
import { TOUR_PAGES, type TourStep } from "@/lib/tourSteps";

type TourContextValue = {
  active: boolean;
  stepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  stepNumber: number;
  startTour: () => void;
  next: () => void;
  back: () => void;
  skipTour: () => void;
};

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within TourProvider");
  return ctx;
}

/**
 * Watches ?tour=1 reactively via useSearchParams (not a mount-time-only
 * check) — TourProvider is mounted once in the root layout and never
 * remounts on client-side navigation, so detection has to react to param
 * changes, not just the first page load. Isolated in its own component so
 * only this (invisible, renders null) piece needs a Suspense boundary —
 * {children} in TourProvider itself is never blocked by it.
 */
function TourUrlWatcher({ onDetected }: { onDetected: () => void }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("tour") !== "1") return;
    // Deferred via setTimeout(0) rather than called synchronously here —
    // onDetected (which calls setState) and router.replace both run inside
    // this async callback boundary, not in the effect body itself.
    const timer = window.setTimeout(() => {
      onDetected();
      const params = new URLSearchParams(searchParams);
      params.delete("tour");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, pathname, router, onDetected]);

  return null;
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const [active, setActive] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);

  const finish = useCallback(() => {
    setActive(false);
    if (user) {
      profileApi
        .upsert(user.id, { tour_completed_at: new Date().toISOString() })
        .catch((err) => console.error("Failed to record tour completion:", err));
    }
  }, [user]);

  const startTour = useCallback(() => {
    const pageIdx = TOUR_PAGES.findIndex((p) => p.path === pathname);
    setPageIndex(pageIdx >= 0 ? pageIdx : 0);
    setStepIndex(0);
    setActive(true);
  }, [pathname]);

  const next = useCallback(() => {
    const page = TOUR_PAGES[pageIndex];
    if (!page) {
      finish();
      return;
    }
    if (stepIndex + 1 < page.steps.length) {
      setStepIndex(stepIndex + 1);
      return;
    }
    const nextPageIndex = pageIndex + 1;
    if (nextPageIndex >= TOUR_PAGES.length) {
      finish();
      return;
    }
    setPageIndex(nextPageIndex);
    setStepIndex(0);
    router.push(TOUR_PAGES[nextPageIndex].path);
  }, [pageIndex, stepIndex, finish, router]);

  const back = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const skipTour = useCallback(() => {
    finish();
  }, [finish]);

  const page = TOUR_PAGES[pageIndex];
  const currentStep = active && page ? (page.steps[stepIndex] ?? null) : null;
  const totalSteps = TOUR_PAGES.reduce((sum, p) => sum + p.steps.length, 0);
  const stepNumber =
    TOUR_PAGES.slice(0, pageIndex).reduce((sum, p) => sum + p.steps.length, 0) +
    stepIndex +
    1;

  return (
    <TourContext.Provider
      value={{
        active,
        stepIndex,
        currentStep,
        totalSteps,
        stepNumber,
        startTour,
        next,
        back,
        skipTour,
      }}
    >
      <Suspense fallback={null}>
        <TourUrlWatcher onDetected={startTour} />
      </Suspense>
      {children}
    </TourContext.Provider>
  );
}
