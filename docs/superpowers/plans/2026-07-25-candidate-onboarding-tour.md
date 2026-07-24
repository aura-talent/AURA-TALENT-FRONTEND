# Candidate Onboarding Tour Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guided, skippable, replayable tour across 5 candidate pages (dashboard, jobs, bounties, evaluate, tracker) that auto-starts once right after onboarding.

**Architecture:** `TourProvider` (mounted once in `app/layout.tsx`) holds all tour state and detects `?tour=1` itself via `window.location.search` in a `useEffect` — no `useSearchParams`/`Suspense` boilerplate needed on the 5 target pages, which only get additive `data-tour="…"` attributes. `TourOverlay` renders the spotlight (pure-CSS technique: a small fixed box with a huge `box-shadow` spread creates the darkened cutout) and tooltip, portal-free (just `position: fixed`, it's already above everything via z-index). One additive column (`tour_completed_at`) on the existing `candidate_profiles` table, written via the existing `profileApi.upsert`.

**Tech Stack:** Next.js App Router, React Context, Supabase (one additive migration), plain CSS (no new dependency).

---

## File structure

- Create `supabase/migrations/20260725130000_candidate_tour.sql` — additive column, no RLS change needed.
- Create `lib/tourSteps.ts` — plain data: 5 pages × 2–3 steps each.
- Create `components/tour/TourProvider.tsx` — context + state machine + `?tour=1` detection + persistence.
- Create `components/tour/TourOverlay.tsx` — the rendered spotlight/tooltip UI.
- Modify `app/layout.tsx` — mount `<TourProvider>` and `<TourOverlay />`.
- Modify `app/profile/page.tsx` — both redirect targets become `/dashboard?tour=1`.
- Modify `components/Nav.tsx` — add a "Take the tour" link next to "My resume" in both account-dropdown occurrences.
- Modify `app/dashboard/page.tsx`, `app/jobs/page.tsx`, `app/bounties/page.tsx`, `app/evaluate/page.tsx`, `app/tracker/page.tsx` — add `data-tour="…"` attributes to existing elements, no structural changes.
- Modify `app/globals.css` — tour overlay/spotlight/tooltip styles.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260725130000_candidate_tour.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Candidate Onboarding Tour
-- Run this against the Supabase project this app points to
-- (NEXT_PUBLIC_SUPABASE_URL in .env.local) via the SQL editor or `supabase db push`.
-- Additive column on the existing candidate_profiles table — its owner-only
-- RLS policies (from 20260725120000_candidate_profiles.sql) already cover it.

alter table public.candidate_profiles
  add column if not exists tour_completed_at timestamptz;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260725130000_candidate_tour.sql
git commit -m "feat: add tour_completed_at column to candidate_profiles"
```

*(No apply step — hand the file to the user to run against their project.)*

---

### Task 2: Extend profile types

**Files:**
- Modify: `lib/profileHelpers.ts`

- [ ] **Step 1: Add the field to `CandidateProfile`**

Find:

```typescript
  linkedin_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
}
```

Replace with:

```typescript
  linkedin_url: string | null;
  portfolio_url: string | null;
  tour_completed_at: string | null;
  created_at: string;
  updated_at: string;
}
```

`ProfilePayload` already derives from `Omit<CandidateProfile, "user_id" | "created_at" | "updated_at">` via `Partial<>`, so it automatically picks up `tour_completed_at` as an optional writable field — no separate change needed there.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add lib/profileHelpers.ts
git commit -m "feat: add tour_completed_at to CandidateProfile type"
```

---

### Task 3: Tour step data

**Files:**
- Create: `lib/tourSteps.ts`

- [ ] **Step 1: Write the step data**

```typescript
export type TourStep = {
  selector: string;
  title: string;
  body: string;
};

export type TourPage = {
  path: string;
  steps: TourStep[];
};

export const TOUR_PAGES: TourPage[] = [
  {
    path: "/dashboard",
    steps: [
      {
        selector: "[data-tour='dashboard-stats']",
        title: "Your numbers at a glance",
        body: "Track how many roles you've applied to, your response rate, and upcoming interviews — all in one place.",
      },
      {
        selector: "[data-tour='dashboard-jobs-panel']",
        title: "Jobs suited for you",
        body: "Once your résumé is on file, Aura scans company portals and surfaces roles that actually match your profile.",
      },
      {
        selector: "[data-tour='dashboard-bounties-panel']",
        title: "Paid bounties",
        body: "Companies post real paid tasks here. Win cash, or build a public track record even if you don't.",
      },
    ],
  },
  {
    path: "/jobs",
    steps: [
      {
        selector: "[data-tour='jobs-search']",
        title: "Search and filter",
        body: "Narrow down roles by keyword, or toggle to only see the ones Aura recommends for you.",
      },
      {
        selector: "[data-tour='jobs-grid']",
        title: "Every role, ranked",
        body: "Each card shows your match score. Click into a role for the full breakdown, or Quick Apply straight from here.",
      },
    ],
  },
  {
    path: "/bounties",
    steps: [
      {
        selector: "[data-tour='bounties-tabs']",
        title: "Browse or track your entries",
        body: "Switch between open bounties and the ones you've already submitted to.",
      },
      {
        selector: "[data-tour='bounties-list']",
        title: "Real paid work",
        body: "Each listing shows the prize pool and how many winners get paid. Click one to see the brief and submit.",
      },
    ],
  },
  {
    path: "/evaluate",
    steps: [
      {
        selector: "[data-tour='evaluate-input']",
        title: "Paste a job link or description",
        body: "Aura reads the posting the way a sharp recruiter would.",
      },
      {
        selector: "[data-tour='evaluate-submit']",
        title: "Score your fit",
        body: "This scores the role against your real résumé and tells you honestly whether it's worth your time.",
      },
    ],
  },
  {
    path: "/tracker",
    steps: [
      {
        selector: "[data-tour='tracker-toolbar']",
        title: "Search and filter your pipeline",
        body: "Find any application by company, role, priority, or tag.",
      },
      {
        selector: "[data-tour='tracker-board']",
        title: "Your hiring pipeline",
        body: "Drag applications between stages as they progress. Click any card for the full timeline and notes.",
      },
    ],
  },
];
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add lib/tourSteps.ts
git commit -m "feat: add candidate tour step data"
```

---

### Task 4: TourProvider

**Files:**
- Create: `components/tour/TourProvider.tsx`

This task depends on Task 3 (imports `TOUR_PAGES`) and the existing `lib/profileApi.ts`/`components/AuthProvider.tsx`.

- [ ] **Step 1: Write the provider**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
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
  const [active, setActive] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const startedFromUrl = useRef(false);

  // Detect ?tour=1 once, client-side only — deliberately not useSearchParams,
  // which would force a Suspense boundary here for something purely cosmetic.
  useEffect(() => {
    if (startedFromUrl.current) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tour") === "1") {
      startedFromUrl.current = true;
      const pageIdx = TOUR_PAGES.findIndex((p) => p.path === pathname);
      setPageIndex(pageIdx >= 0 ? pageIdx : 0);
      setStepIndex(0);
      setActive(true);
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
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/tour/TourProvider.tsx
git commit -m "feat: add TourProvider state machine"
```

---

### Task 5: TourOverlay

**Files:**
- Create: `components/tour/TourOverlay.tsx`

This task depends on Task 4.

- [ ] **Step 1: Write the overlay**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTour } from "./TourProvider";

const FIND_TIMEOUT_MS = 1500;
const FIND_INTERVAL_MS = 100;

export default function TourOverlay() {
  const { active, currentStep, stepIndex, stepNumber, totalSteps, next, back, skipTour } =
    useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setRect(null);
    setNotFound(false);
    if (!active || !currentStep) return;

    let cancelled = false;
    let elapsed = 0;

    function poll() {
      if (cancelled || !currentStep) return;
      const el = document.querySelector(currentStep.selector);
      if (el) {
        setRect(el.getBoundingClientRect());
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      elapsed += FIND_INTERVAL_MS;
      if (elapsed >= FIND_TIMEOUT_MS) {
        setNotFound(true);
        return;
      }
      window.setTimeout(poll, FIND_INTERVAL_MS);
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [active, currentStep]);

  // A target that never appears (e.g. an empty-state page) shouldn't hang
  // the tour — skip forward instead.
  useEffect(() => {
    if (notFound) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  useEffect(() => {
    if (!active || !currentStep) return;
    function reposition() {
      if (!currentStep) return;
      const el = document.querySelector(currentStep.selector);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [active, currentStep]);

  if (!active || !currentStep || !rect) return null;

  const pad = 8;
  const spotlightTop = rect.top - pad;
  const spotlightLeft = rect.left - pad;
  const spotlightWidth = rect.width + pad * 2;
  const spotlightHeight = rect.height + pad * 2;
  const tooltipTop = Math.min(
    spotlightTop + spotlightHeight + 12,
    window.innerHeight - 220,
  );
  const tooltipLeft = Math.min(Math.max(spotlightLeft, 16), window.innerWidth - 336);

  return (
    <div className="tour-overlay">
      <div
        className="tour-spotlight"
        style={{
          top: spotlightTop,
          left: spotlightLeft,
          width: spotlightWidth,
          height: spotlightHeight,
        }}
      />
      <div className="tour-tooltip" style={{ top: tooltipTop, left: tooltipLeft }}>
        <span className="tour-tooltip-step">
          Step {stepNumber} of {totalSteps}
        </span>
        <h4>{currentStep.title}</h4>
        <p>{currentStep.body}</p>
        <div className="tour-tooltip-actions">
          <button className="btn btn-ghost" onClick={skipTour}>
            Skip tour
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {stepIndex > 0 && (
              <button className="btn btn-ghost" onClick={back}>
                Back
              </button>
            )}
            <button className="btn btn-primary" onClick={next}>
              {stepNumber === totalSteps ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/tour/TourOverlay.tsx
git commit -m "feat: add TourOverlay spotlight and tooltip UI"
```

---

### Task 6: Tour CSS

**Files:**
- Modify: `app/globals.css` (append to the end of the file)

- [ ] **Step 1: Append the CSS**

```css

/* Candidate onboarding tour */
.tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 300;
}
.tour-spotlight {
  position: fixed;
  border-radius: 8px;
  box-shadow: 0 0 0 9999px rgba(11, 14, 28, 0.65);
  transition:
    top 0.25s ease,
    left 0.25s ease,
    width 0.25s ease,
    height 0.25s ease;
  pointer-events: none;
}
.tour-tooltip {
  position: fixed;
  width: 320px;
  background: var(--surface);
  border: 1px solid var(--ink-30);
  padding: 1.1rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 301;
}
.tour-tooltip-step {
  display: block;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--iris);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.4rem;
}
.tour-tooltip h4 {
  font-size: 1rem;
  margin-bottom: 0.4rem;
}
.tour-tooltip p {
  font-size: 0.85rem;
  color: var(--ink-72);
  margin-bottom: 1rem;
  line-height: 1.5;
}
.tour-tooltip-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add candidate tour overlay styles"
```

---

### Task 7: Mount the provider and overlay

**Files:**
- Modify: `app/layout.tsx`

This task depends on Tasks 4–6. **Before editing, re-read the current file** — it has drifted mid-session before.

- [ ] **Step 1: Add imports and mount `TourProvider`/`TourOverlay`**

Find:

```tsx
import Nav from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { RouteGuard } from "@/components/RouteGuard";
import "./globals.css";
```

Replace with:

```tsx
import Nav from "@/components/Nav";
import { AuthProvider } from "@/components/AuthProvider";
import { RouteGuard } from "@/components/RouteGuard";
import { TourProvider } from "@/components/tour/TourProvider";
import TourOverlay from "@/components/tour/TourOverlay";
import "./globals.css";
```

Find:

```tsx
        <AuthProvider>
          <RouteGuard>
            <Nav />
            <main>{children}</main>
            <footer className="footer">
```

Replace with:

```tsx
        <AuthProvider>
          <RouteGuard>
            <TourProvider>
              <Nav />
              <main>{children}</main>
              <TourOverlay />
            <footer className="footer">
```

And find the matching close (later in the same block):

```tsx
              </div>
            </footer>
          </RouteGuard>
        </AuthProvider>
```

Replace with:

```tsx
              </div>
            </footer>
            </TourProvider>
          </RouteGuard>
        </AuthProvider>
```

(The indentation on the two moved lines is intentionally left shallow — fix it to match the file's actual style when applying, since exact whitespace depends on the file's current state at edit time.)

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/layout.tsx`
Expected: no output from either command

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: mount TourProvider and TourOverlay in root layout"
```

---

### Task 8: Profile page redirects to `?tour=1`

**Files:**
- Modify: `app/profile/page.tsx`

- [ ] **Step 1: Update both redirect targets**

Find:

```tsx
    try {
      await profileApi.upsert(user.id, payload);
      setSaved(true);
      window.setTimeout(() => router.push("/dashboard"), 500);
```

Replace with:

```tsx
    try {
      await profileApi.upsert(user.id, payload);
      setSaved(true);
      window.setTimeout(() => router.push("/dashboard?tour=1"), 500);
```

Find:

```tsx
        <button className="btn btn-ghost" onClick={() => router.push("/dashboard")}>
          Skip for now
        </button>
```

Replace with:

```tsx
        <button className="btn btn-ghost" onClick={() => router.push("/dashboard?tour=1")}>
          Skip for now
        </button>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/profile/page.tsx`
Expected: no output from either command

- [ ] **Step 3: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: trigger onboarding tour after profile save or skip"
```

---

### Task 9: "Take the tour" replay link

**Files:**
- Modify: `components/Nav.tsx`

This exact block appears twice in the file (landing-page dropdown and app dropdown) — use `replace_all` to update both in one edit. **Re-read the file first** — it has drifted mid-session before.

- [ ] **Step 1: Add the link with `replace_all`**

Find (appears twice):

```tsx
                      {role === "candidate" && (
                        <Link
                          href="/my-resume"
                          onClick={() => setDropdownOpen(false)}
                          style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                          className="dropdown-item"
                        >
                          My resume
                        </Link>
                      )}
```

Replace both occurrences with:

```tsx
                      {role === "candidate" && (
                        <>
                          <Link
                            href="/my-resume"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            My resume
                          </Link>
                          <Link
                            href="/dashboard?tour=1"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            Take the tour
                          </Link>
                        </>
                      )}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/Nav.tsx`
Expected: `tsc` produces no output. `eslint` may show the two pre-existing `react-hooks/set-state-in-effect` errors on lines unrelated to this change (already present before this session touched the file) — no new errors on the lines this step changed.

- [ ] **Step 3: Commit**

```bash
git add components/Nav.tsx
git commit -m "feat: add Take the tour link to candidate account menu"
```

---

### Task 10: `data-tour` anchors on the 5 target pages

**Files:**
- Modify: `app/dashboard/page.tsx`, `app/jobs/page.tsx`, `app/bounties/page.tsx`, `app/evaluate/page.tsx`, `app/tracker/page.tsx`

Each of these files is large and has drifted mid-session already — **re-read the specific target region of each file immediately before editing it**, don't rely on a snapshot. The changes below are additive single-attribute (or single-wrapper) insertions on elements confirmed present as of this plan's writing; if a target has since moved or been restyled, find the semantically equivalent element (the outer panel/container for that section) and anchor there instead — do not skip a page's anchors, adapt to the current markup.

- [ ] **Step 1: Dashboard — 3 anchors**

In the KPI Scorecards Grid, find:

```tsx
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              
              {/* Total Apps */}
```

Replace with:

```tsx
            <div data-tour="dashboard-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              
              {/* Total Apps */}
```

In the "Suited jobs for you" panel, find:

```tsx
          <div className="dash-col" style={{ minWidth: 0 }}>
            <div className="panel">
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />
              
              <div className="page-kicker" style={{ marginBottom: "0.6rem" }}>
                LIVE_SCAN // PORTALS
              </div>
```

Replace with:

```tsx
          <div className="dash-col" style={{ minWidth: 0 }}>
            <div className="panel" data-tour="dashboard-jobs-panel">
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />
              
              <div className="page-kicker" style={{ marginBottom: "0.6rem" }}>
                LIVE_SCAN // PORTALS
              </div>
```

In the Paid Bounties Panel, find:

```tsx
            {/* Paid Bounties Panel */}
            <div className="panel" style={{ marginTop: "2rem" }}>
```

Replace with:

```tsx
            {/* Paid Bounties Panel */}
            <div className="panel" data-tour="dashboard-bounties-panel" style={{ marginTop: "2rem" }}>
```

- [ ] **Step 2: Jobs — 2 anchors**

Find:

```tsx
          <div className="jobs-explore-toolbar panel">
```

Replace with:

```tsx
          <div className="jobs-explore-toolbar panel" data-tour="jobs-search">
```

Find:

```tsx
          <div className="candidate-job-grid">
```

Replace with:

```tsx
          <div className="candidate-job-grid" data-tour="jobs-grid">
```

- [ ] **Step 3: Bounties — 2 anchors**

Find the tab row (two buttons "Recent Bounties" / "Submitted Bounties"), specifically its wrapping div (has `borderBottom: "1px solid var(--ink-10)"` and `marginBottom: "1.75rem"` in its style object) — add `data-tour="bounties-tabs"` to that div's props.

Find the "Tab 1: Recent Bounties" fragment:

```tsx
        {activeTab === "recent" && (
          <>
```

Replace with:

```tsx
        {activeTab === "recent" && (
          <div data-tour="bounties-list">
```

And find its matching closing fragment tag (the `</>` that closes this specific block, immediately before the "Tab 2: Submitted Bounties" comment) and change it to `</div>`.

- [ ] **Step 4: Evaluate — 2 anchors**

In the initial (no-result) view, find:

```tsx
      <div className="panel">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={mode === "url"} onClick={() => setMode("url")}>
            Job link
          </button>
```

Replace with:

```tsx
      <div className="panel" data-tour="evaluate-input">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={mode === "url"} onClick={() => setMode("url")}>
            Job link
          </button>
```

Find:

```tsx
        <button
          className="btn btn-primary"
          disabled={hasResume === false || (mode === "url" ? !url.trim().startsWith("http") : text.trim().length < 200)}
          onClick={run}
        >
          Score this job
        </button>
```

Replace with:

```tsx
        <button
          className="btn btn-primary"
          data-tour="evaluate-submit"
          disabled={hasResume === false || (mode === "url" ? !url.trim().startsWith("http") : text.trim().length < 200)}
          onClick={run}
        >
          Score this job
        </button>
```

- [ ] **Step 5: Tracker — 2 anchors**

Find:

```tsx
        <div className="tracker-toolbar panel" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", padding: "1rem", marginBottom: "2rem" }}>
```

Replace with:

```tsx
        <div className="tracker-toolbar panel" data-tour="tracker-toolbar" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", justifyContent: "space-between", padding: "1rem", marginBottom: "2rem" }}>
```

Find the kanban board grid container (the div directly under the `{/* ─── KANBAN BOARD ─── */}` comment, with `gridTemplateColumns: "repeat(4, 1fr)"` in its style):

```tsx
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                alignItems: "start",
              }}
            >
```

Replace with:

```tsx
            <div
              data-tour="tracker-board"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "0.75rem",
                alignItems: "start",
              }}
            >
```

- [ ] **Step 6: Type-check and lint all five**

Run: `npx tsc --noEmit && npx eslint app/dashboard/page.tsx app/jobs/page.tsx app/bounties/page.tsx app/evaluate/page.tsx app/tracker/page.tsx`
Expected: `tsc` no output. `eslint` shows no *new* errors on the lines this task touched (pre-existing unrelated errors elsewhere in these files, if any, are not this task's concern).

- [ ] **Step 7: Commit**

```bash
git add app/dashboard/page.tsx app/jobs/page.tsx app/bounties/page.tsx app/evaluate/page.tsx app/tracker/page.tsx
git commit -m "feat: add data-tour anchors to the 5 tour target pages"
```

---

### Task 11: Manual end-to-end verification

**Blocked until the user has applied `supabase/migrations/20260725130000_candidate_tour.sql`.**

- [ ] **Step 1:** As a candidate with no saved profile, finish onboarding and land on `/profile?welcome=1`. Save (or Skip). Expected: redirected to `/dashboard`, tour auto-starts with the URL's `?tour=1` stripped (check the address bar), spotlight is on the KPI stats row, step counter reads "Step 1 of 11".
- [ ] **Step 2:** Click Next through all 3 dashboard steps. Expected: on the 3rd step's Next, navigates to `/jobs`, tour continues at step 4 (the search bar) without restarting from step 1.
- [ ] **Step 3:** Continue through `/jobs` into `/bounties`. Click "Skip tour" partway through a `/bounties` step. Expected: overlay closes immediately, page stays on `/bounties` (no further auto-navigation to `/evaluate`).
- [ ] **Step 4:** Reload `/dashboard` (plain, no query param). Expected: tour does not auto-start.
- [ ] **Step 5:** Open the account dropdown, click "Take the tour". Expected: tour restarts from step 1 on `/dashboard`, regardless of the completed state from Step 3.
- [ ] **Step 6:** Resize the browser or scroll the page mid-step. Expected: the spotlight box repositions to stay aligned with its target.

---

## Self-review notes

- **Spec coverage:** §1 (what it is) → Tasks 3–7. §2 (data model) → Task 1–2. §3 (trigger & flow, including the element-not-found timeout and skip behavior) → Tasks 4–5. §4 (frontend structure) → Tasks 3–7, 10. §5 (step content) → Task 3. §6 (error handling: empty states, manual navigation away, missing profile row) → handled by Task 5's polling/timeout and Task 4's `finish()` creating the row via upsert regardless of prior existence. §7 (out of scope) → not built, nothing to verify. §8 (testing) → Task 11.
- **Type consistency check:** `useTour()`'s returned shape (`active`, `stepIndex`, `currentStep`, `totalSteps`, `stepNumber`, `startTour`, `next`, `back`, `skipTour`) is used identically in Task 5's `TourOverlay` — no renamed fields between the two tasks.
- **Nav.tsx and app/layout.tsx are called out explicitly for a fresh re-read before editing**, since both drifted mid-session earlier in this project (see the bounty and profile feature history) — this isn't hypothetical caution, it's already happened twice.
