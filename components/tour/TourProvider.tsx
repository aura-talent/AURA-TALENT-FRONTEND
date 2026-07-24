"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
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

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  // Detect ?tour=1 once, client-side only, via lazy initializers — deliberately
  // not useSearchParams (which would force a Suspense boundary here for
  // something purely cosmetic) or a setState-in-effect (which the
  // react-hooks/set-state-in-effect rule flags as a cascading-render risk).
  const [active, setActive] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("tour") === "1";
  });
  const [pageIndex, setPageIndex] = useState(() => {
    if (typeof window === "undefined") return 0;
    if (new URLSearchParams(window.location.search).get("tour") !== "1") return 0;
    const idx = TOUR_PAGES.findIndex((p) => p.path === window.location.pathname);
    return idx >= 0 ? idx : 0;
  });
  const [stepIndex, setStepIndex] = useState(0);

  // Strip ?tour=1 from the URL once the initial state above has captured it.
  // This effect only calls router.replace (navigation, not setState), so it
  // doesn't trip the same lint rule.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      const url = new URL(window.location.href);
      url.searchParams.delete("tour");
      router.replace(url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {children}
    </TourContext.Provider>
  );
}
