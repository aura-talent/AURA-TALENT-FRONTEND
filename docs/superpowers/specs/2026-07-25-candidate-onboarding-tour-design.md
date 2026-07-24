# Candidate Onboarding Tour — Design Spec

**Date:** 2026-07-25
**Status:** Approved pending final user review
**Repos:** AURA-TALENT-FRONTEND only. One additive column on the existing `candidate_profiles` table (from the profile feature), no other backend/Supabase-adjacent changes.
**Context:** New candidates now land on `/profile` right after their first résumé upload (see `docs/superpowers/specs/2026-07-25-candidate-profile-onboarding-design.md`), then continue to `/dashboard`. This adds the next step: a short guided walk across the app's main pages, so a first-time candidate understands what each part does before they're left to explore alone.

## 1. What it is

A custom, dependency-free guided tour: a darkened overlay with a spotlight cutout around one UI element at a time, plus a tooltip (title, short explanation, step counter, Back/Next/Skip). The walk spans five pages in sequence — `/dashboard` → `/jobs` → `/bounties` → `/evaluate` → `/tracker` — auto-navigating between them as the candidate clicks Next. It starts automatically once, right after onboarding, and can be replayed on demand from the account menu. Employer-side tours, per-step analytics, and pages beyond these five are explicitly out of scope for this round.

## 2. Data model

One additive column on the existing table (no new table):

```sql
alter table public.candidate_profiles
  add column if not exists tour_completed_at timestamptz;
```

No RLS change needed — the existing owner-only policies on `candidate_profiles` already cover this column. `profileApi.upsert` (already built) is reused to write it; no new API file.

## 3. Trigger & flow

- `/profile`'s "Save & continue" and "Skip for now" actions both already redirect to plain `/dashboard`; both change to `/dashboard?tour=1`.
- Each of the five pages checks `searchParams.get("tour") === "1"` on mount (via the same `useSearchParams` + `<Suspense>` wrapper pattern already used on `/profile` and `/login`) and calls `startTour()` if present.
- **`TourProvider`** (mounted once in `app/layout.tsx`, above `<Nav />` and `{children}`, so its React state survives client-side route changes) tracks `active: boolean`, `pageIndex: number`, `stepIndex: number`, and exposes `startTour()`, `next()`, `back()`, `skipTour()`.
- Advancing `next()` past the last step of a page's step list triggers `router.push()` to the next page's route (still carrying no query param — the provider's own state is the source of truth for "tour still active," not the URL, once started) and resets `stepIndex` to 0. Before showing the new page's first tooltip, the provider polls for its target element (`document.querySelector`) for up to ~1.5s; if the element never appears (e.g. an empty-state dashboard with no target card rendered), that step is skipped rather than the tour hanging.
- Finishing the last step of `/tracker`, or clicking **Skip tour** on any step, both: close the overlay, strip any tour-related UI state, and call `profileApi.upsert(userId, { tour_completed_at: new Date().toISOString() })`. Skip does **not** continue navigating through remaining pages — it stops exactly where the candidate skipped.
- **Replay:** a "Take the tour" link added to the account dropdown menu (`components/Nav.tsx`, same dropdown that already holds sign-out) links to `/dashboard?tour=1`, which works identically whether or not `tour_completed_at` is already set — replay is an explicit action, not gated on completion state.

## 4. Frontend structure

- **`lib/tourSteps.ts`** — plain data, no logic: an ordered array of pages, each `{ path: string, steps: { selector: string, title: string, body: string }[] }`. This is the only file content-editors need to touch to change tour copy later.
- **`components/tour/TourProvider.tsx`** — the context + state machine described in §3. Client component, `"use client"`.
- **`components/tour/TourOverlay.tsx`** — the actual rendered overlay + tooltip, portal-rendered so it sits above page content regardless of where `TourProvider` is mounted in the tree. Computes the spotlight cutout from `getBoundingClientRect()` on the current step's target, recalculated on `scroll`/`resize` while active.
- Existing components on the five target pages get `data-tour="…"` attributes added directly (additive markup only — e.g. the dashboard stats row, the jobs search bar, a bounty list row, the evaluate textarea, the tracker board). No component is restructured to accommodate this.
- `components/Nav.tsx` gains the "Take the tour" link in the existing account dropdown.
- `app/layout.tsx` wraps its existing tree with `<TourProvider>`.

## 5. Step content (finalized during implementation, not fixed here)

Roughly 2–3 steps per page, ~11 total:
- **Dashboard**: stats row, "Suited jobs for you" panel, "Job Bounties" panel.
- **Jobs**: search/filter bar, a job card.
- **Bounties**: filter pills, a bounty row.
- **Evaluate**: the JD input, the Evaluate action.
- **Tracker**: the board/status columns, an application card.

## 6. Error handling & edge cases

- **Empty-state pages**: covered in §3 (element-not-found timeout skips the step, doesn't hang).
- **Candidate navigates away manually mid-tour** (e.g. clicks a nav link instead of Next): the tour simply doesn't re-trigger on the page they land on unless it also happens to be one of the five *and* they still have `active: true` in provider state with a pending step for it — in practice this means manually navigating off-sequence quietly abandons the tour without marking it complete (a reasonable v1 behavior; they can resume via "Take the tour" later, which will restart from step one rather than resume mid-way — no partial-resume state is persisted).
- **`candidate_profiles` row doesn't exist yet** (candidate skipped `/profile` without ever saving): `profileApi.upsert` already creates the row on any write, so marking `tour_completed_at` works the same whether or not a row existed before.

## 7. Explicitly out of scope

- Employer-side onboarding tour.
- Per-step analytics or drop-off tracking (no product-analytics infrastructure exists in this repo).
- Tours on any page beyond the five named here.
- Resuming a manually-abandoned tour mid-sequence (§6) — replay always restarts from the beginning.

## 8. Testing

No existing test suite covers onboarding/dashboard/nav UI — consistent with the rest of the candidate-facing surface, this follows the same manual-verification convention as the bounty and profile features. Manual verification plan: finish onboarding as a new candidate, confirm the tour auto-starts on `/dashboard` with the right spotlight target, click Next through to `/jobs`, confirm auto-navigation and the next step's spotlight appears, click Skip partway through `/bounties` and confirm it stops there (no further auto-navigation) and `tour_completed_at` is set, reload `/dashboard` and confirm the tour does not auto-restart, then use "Take the tour" from the account menu and confirm it replays from the beginning regardless of completion state.
