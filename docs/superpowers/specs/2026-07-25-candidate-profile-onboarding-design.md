# Candidate Profile & Onboarding — Design Spec

**Date:** 2026-07-25
**Status:** Approved pending final user review
**Repos:** AURA-TALENT-FRONTEND only. Like the bounty feature, this is deliberately Supabase-direct (new table + RLS), no FastAPI backend changes — the existing AI résumé-parsing pipeline (`api.uploadResume` / `api.submitResumeText`, proxied through `/api/backend/resume/...`) is used as-is, read-only, as a seed source.
**Context:** Candidates already upload a résumé during onboarding (`app/onboarding/page.tsx`) and the backend already extracts a loose structured `profile` blob alongside the parsed markdown (`ResumeData.profile: Record<string, unknown>`, confirmed keys today: `headline`, `top_skills`, `target_archetypes` — used read-only in `app/dashboard/page.tsx` and `app/my-resume/page.tsx`). There is no page to view those fields as an editable profile, and no way to correct AI extraction errors or fill in gaps. This adds that missing piece and wires it into the new-candidate onboarding path.

## 1. What it is

A new candidate-owned, editable profile (`/profile`) auto-filled once from the résumé parser's output and the Auth session, then independently editable forever after. New candidates are routed here right after their first successful résumé upload, with a skip option. Existing candidates can reach it any time via nav or from `/my-resume`.

## 2. Data model

One new Supabase table, RLS owner-only (see the bounty migration's lesson: `public.users.id` is `text`, not `uuid` — every `auth.uid()` comparison casts with `::text`):

```
candidate_profiles
  user_id           text PK references users(id)
  full_name         text
  contact_email     text
  phone             text
  location          text
  headline          text
  skills            text[] not null default '{}'
  years_experience  integer
  target_roles      text[] not null default '{}'
  salary_low        numeric
  salary_high       numeric
  salary_currency   text not null default 'USD'
  linkedin_url      text
  portfolio_url     text
  created_at        timestamptz not null default now()
  updated_at        timestamptz not null default now()
```

RLS: `SELECT`/`INSERT`/`UPDATE` restricted to `user_id = auth.uid()::text`. No `DELETE` policy — a profile, once created, is edited, not removed. No row is created until the candidate explicitly saves; loading `/profile` for the first time does not insert an empty record.

## 3. Pre-fill logic

When `/profile` loads and no `candidate_profiles` row exists yet for the candidate, the form is seeded (client-side, not persisted until Save) from:
- `full_name`, `contact_email` ← Supabase Auth session (`user.user_metadata?.full_name ?? user.user_metadata?.name`, `user.email`) — same pattern already used in `components/employer/EmployerShell.tsx`.
- `headline` ← `resume.profile.headline` if present.
- `skills` ← `resume.profile.top_skills` if present and an array of strings.
- `target_roles` ← `resume.profile.target_archetypes` if present and an array of strings.
- `phone`, `location`, `years_experience`, `salary_low/high`, `linkedin_url`, `portfolio_url` — left blank; the AI parser's output shape beyond the three confirmed keys is unknown from this repo (backend is separate), so these are manual-entry-only for now. If `resume.profile` happens to contain matching keys (`location`, `phone`, etc.) at runtime, the same best-effort lookup pattern applies, but no field is assumed present.

Fetching the résumé for seeding reuses the existing `api.getResume()` call; if it 404s (no résumé on file) or the fields aren't present, the corresponding form fields simply start empty — no error state, this is a normal case (e.g. a candidate who reaches `/profile` without having uploaded a résumé yet).

**Once a `candidate_profiles` row exists, seeding never runs again.** Re-uploading a résumé later does not touch this table. This is a deliberate v1 scope cut — re-syncing is a separate future feature, not silent overwrite risk.

## 4. Onboarding flow change

In `app/onboarding/page.tsx`, the success screen (`done` state) for new candidates (`isNewUser`) currently shows:
```
<button className="btn btn-primary" onClick={() => router.push(isNewUser ? "/dashboard" : "/evaluate")}>
  {isNewUser ? "Go to Dashboard" : "Evaluate your first job"}
</button>
```
For `isNewUser` only, this becomes a link to `/profile` with copy "Review your profile →". The non-new-user branch (`/evaluate`) is unchanged — this is scoped to new-candidate onboarding, not the résumé-replace flow existing candidates already use.

`/profile` itself provides two exits: **"Save & continue"** (upserts `candidate_profiles`, then `router.push("/dashboard")`) and a plain **"Skip for now"** link (`router.push("/dashboard")`, no save) — satisfying "skippable but prompted," not a hard gate. No `RouteGuard` changes are needed since nothing is blocked.

## 5. Frontend structure

- **`lib/profileHelpers.ts`** — pure types (`CandidateProfile`, `ProfilePayload`) mirroring `lib/bountyHelpers.ts`'s shape. No pure logic complex enough to warrant unit tests here (unlike the bounty prize-math helpers) — it's field plumbing.
- **`lib/profileApi.ts`** — `profileApi.getMine(userId)`, `profileApi.upsert(userId, payload)`, calling `supabase.from("candidate_profiles")` directly. Mirrors `lib/bountyApi.ts`'s structure and error handling (`throw new Error(error.message)` on any Supabase error).
- **`app/profile/page.tsx`** — client component, sections in one page (not split into a multi-file editor like the bounty editor, since this form is simpler and has no add/remove list items beyond two tag fields):
  - **Basics**: full name, contact email, phone, location, headline (text inputs).
  - **Skills & targets**: `skills` and `target_roles` as tag editors (reusing the same add/remove-chip interaction already built for the bounty editor's `tags` field — label, input+Add button, removable chip list).
  - **Compensation**: salary low/high + currency select (same 3-field layout already used in `JobDetailsSection.tsx`'s salary range).
  - **Links**: LinkedIn URL, portfolio URL (text inputs).
  - Header actions, always both, regardless of entry point: **"Save & continue"** (primary; upserts, then `router.push("/dashboard")`) and **"Skip for now"** (ghost link straight to `/dashboard`, no save). Showing both unconditionally avoids a conditional-visibility edge case (e.g. a returning candidate with no saved profile row yet visiting from nav) for no real benefit — "Skip" reads fine as "leave without saving" in either context.
  - Query param `?welcome=1` (set by the onboarding redirect) only changes the heading/intro copy to the new-candidate framing ("You're all set — let's get your profile right" vs. a plain "Edit your profile" for normal visits). It does not change which actions are shown.
- **Nav**: add `{ href: "/profile", label: "PROFILE" }` to `APP_LINKS` in `components/Nav.tsx`.
- **`app/my-resume/page.tsx`**: add a small `Link` to `/profile` ("Edit profile") next to the existing "Upload new résumé →" button in the page head actions row.

## 6. Explicitly out of scope

- Automatic re-sync of `candidate_profiles` when a résumé is re-uploaded (flagged in §3).
- Any backend/FastAPI changes — `api.uploadResume`/`getResume` are used exactly as they exist today, read-only.
- Surfacing this profile to employers (talent pool, candidate detail view, etc.) — this is the candidate's own editable copy only, not a new employer-facing data source.
- Field-level validation beyond basic presence (e.g. URL format checking, phone number formatting) — plain text inputs, saved as typed.

## 7. Testing

No existing test suite covers `app/onboarding/*`, `app/my-resume/*`, or `lib/api.ts`'s resume functions — this follows the same convention (manual verification via dev server), consistent with the rest of the candidate-facing surface and the precedent set by the bounty feature's employer/candidate UI. Manual verification plan: sign up a new candidate, upload a résumé, confirm the "Review your profile →" CTA appears and pre-fills headline/skills/target roles from the parsed résumé plus name/email from the auth session, save, confirm redirect to `/dashboard`, revisit `/profile` from nav and confirm the saved values persist and are editable, confirm "Skip for now" on a fresh (no-profile-row) visit goes straight to `/dashboard` without creating a row.
