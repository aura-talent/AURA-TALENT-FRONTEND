# Candidate Profile & Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give candidates an editable profile page, auto-filled once from their résumé/auth session, and route new candidates there right after their first résumé upload.

**Architecture:** One new Supabase table (`candidate_profiles`, RLS owner-only, `user_id` is `text` matching `public.users.id`'s actual type — see `supabase/migrations/20260724120000_bounty_reward_mechanism.sql` for the same lesson), driven directly from Next.js via `supabase-js`. The existing backend résumé parser (`api.uploadResume`/`api.getResume`) is used exactly as-is, read-only, as a one-time seed source — no backend changes.

**Tech Stack:** Next.js App Router, Supabase (Postgres + RLS + `supabase-js`), TypeScript, existing global CSS classes (`panel`, `field`, `input`, `chip`, `form-grid`, `page-head`).

---

## File structure

- Create `supabase/migrations/20260725120000_candidate_profiles.sql` — table + RLS. Not applied by the agent (no working Supabase MCP connection to this project) — user runs it manually, same as the bounty migration.
- Create `lib/profileHelpers.ts` — pure types only (`CandidateProfile`, `ProfilePayload`).
- Create `lib/profileApi.ts` — `profileApi.getMine`/`profileApi.upsert`, Supabase-direct, mirrors `lib/bountyApi.ts`.
- Create `app/profile/page.tsx` — the editable profile page.
- Modify `components/Nav.tsx` — add `PROFILE` to `APP_LINKS`.
- Modify `app/onboarding/page.tsx` — new-candidate success CTA points to `/profile?welcome=1` instead of `/dashboard`.
- Modify `app/my-resume/page.tsx` — add an "Edit profile" link next to "Upload new résumé →".
- Modify `app/globals.css` — add two small global classes for the removable-tag editor (skills / target roles), reused for both fields.

---

### Task 1: Database migration

**Files:**
- Create: `supabase/migrations/20260725120000_candidate_profiles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Candidate Profile
-- Run this against the Supabase project this app points to
-- (NEXT_PUBLIC_SUPABASE_URL in .env.local) via the SQL editor or `supabase db push`.
-- public.users.id is TEXT (confirmed in the bounty migration), not uuid — every
-- auth.uid() comparison below casts with ::text.

create table if not exists public.candidate_profiles (
  user_id           text primary key references public.users(id),
  full_name         text,
  contact_email     text,
  phone             text,
  location          text,
  headline          text,
  skills            text[] not null default '{}',
  years_experience  integer,
  target_roles      text[] not null default '{}',
  salary_low        numeric,
  salary_high       numeric,
  salary_currency   text not null default 'USD',
  linkedin_url      text,
  portfolio_url     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.candidate_profiles enable row level security;

create policy "candidate_profiles_select_own" on public.candidate_profiles
  for select
  to authenticated
  using (user_id = auth.uid()::text);

create policy "candidate_profiles_insert_own" on public.candidate_profiles
  for insert
  to authenticated
  with check (user_id = auth.uid()::text);

create policy "candidate_profiles_update_own" on public.candidate_profiles
  for update
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260725120000_candidate_profiles.sql
git commit -m "feat: add candidate_profiles database schema"
```

*(No apply step — hand the file to the user to run against their project, same as the bounty migration.)*

---

### Task 2: Pure types

**Files:**
- Create: `lib/profileHelpers.ts`

- [ ] **Step 1: Write the types**

```typescript
export interface CandidateProfile {
  user_id: string;
  full_name: string | null;
  contact_email: string | null;
  phone: string | null;
  location: string | null;
  headline: string | null;
  skills: string[];
  years_experience: number | null;
  target_roles: string[];
  salary_low: number | null;
  salary_high: number | null;
  salary_currency: string;
  linkedin_url: string | null;
  portfolio_url: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfilePayload = Partial<
  Omit<CandidateProfile, "user_id" | "created_at" | "updated_at">
>;
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add lib/profileHelpers.ts
git commit -m "feat: add candidate profile types"
```

---

### Task 3: Supabase API client

**Files:**
- Create: `lib/profileApi.ts`

- [ ] **Step 1: Write the client**

```typescript
/**
 * Candidate profile API client. Talks directly to Supabase, not the
 * /api/backend FastAPI proxy — mirrors lib/bountyApi.ts's pattern.
 */
import { supabase } from "./supabaseClient";
import type { CandidateProfile, ProfilePayload } from "./profileHelpers";

export * from "./profileHelpers";

export const profileApi = {
  getMine: async (userId: string): Promise<CandidateProfile | null> => {
    const { data, error } = await supabase
      .from("candidate_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as CandidateProfile | null;
  },

  upsert: async (userId: string, payload: ProfilePayload): Promise<CandidateProfile> => {
    const { data, error } = await supabase
      .from("candidate_profiles")
      .upsert(
        { user_id: userId, ...payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as CandidateProfile;
  },
};
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add lib/profileApi.ts
git commit -m "feat: add Supabase-backed candidate profile API client"
```

---

### Task 4: Global CSS for the removable-tag editor

**Files:**
- Modify: `app/globals.css` (append to the end of the file)

- [ ] **Step 1: Append the CSS**

```css

/* Candidate profile: removable-tag editor (skills, target roles) */
.tag-input-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.tag-input-row input {
  flex: 1;
}
.tag-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.tag-chip-list .chip button {
  margin-left: 0.4rem;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.85rem;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/globals.css
git commit -m "feat: add removable-tag editor styles for candidate profile"
```

---

### Task 5: Profile page

**Files:**
- Create: `app/profile/page.tsx`

This task depends on Tasks 2–4.

- [ ] **Step 1: Write the page**

```tsx
"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type ResumeData } from "@/lib/api";
import { profileApi, type CandidateProfile, type ProfilePayload } from "@/lib/profileApi";
import { Loader } from "@/components/ui/loader";

type FormState = {
  fullName: string;
  contactEmail: string;
  phone: string;
  location: string;
  headline: string;
  skills: string[];
  yearsExperience: string;
  targetRoles: string[];
  salaryLow: string;
  salaryHigh: string;
  salaryCurrency: string;
  linkedinUrl: string;
  portfolioUrl: string;
};

const emptyForm: FormState = {
  fullName: "",
  contactEmail: "",
  phone: "",
  location: "",
  headline: "",
  skills: [],
  yearsExperience: "",
  targetRoles: [],
  salaryLow: "",
  salaryHigh: "",
  salaryCurrency: "USD",
  linkedinUrl: "",
  portfolioUrl: "",
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function formFromProfile(profile: CandidateProfile): FormState {
  return {
    fullName: profile.full_name ?? "",
    contactEmail: profile.contact_email ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    headline: profile.headline ?? "",
    skills: profile.skills,
    yearsExperience: profile.years_experience != null ? String(profile.years_experience) : "",
    targetRoles: profile.target_roles,
    salaryLow: profile.salary_low != null ? String(profile.salary_low) : "",
    salaryHigh: profile.salary_high != null ? String(profile.salary_high) : "",
    salaryCurrency: profile.salary_currency,
    linkedinUrl: profile.linkedin_url ?? "",
    portfolioUrl: profile.portfolio_url ?? "",
  };
}

function seedFromResume(
  resumeProfile: Record<string, unknown> | undefined,
  authFullName: string,
  authEmail: string,
): FormState {
  return {
    ...emptyForm,
    fullName: authFullName,
    contactEmail: authEmail,
    headline: typeof resumeProfile?.headline === "string" ? resumeProfile.headline : "",
    skills: stringArray(resumeProfile?.top_skills),
    targetRoles: stringArray(resumeProfile?.target_archetypes),
  };
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [skillDraft, setSkillDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/profile");
      return;
    }
    let cancelled = false;
    profileApi
      .getMine(user.id)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setForm(formFromProfile(existing));
          setLoading(false);
          return;
        }
        const authFullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
        const authEmail = user.email ?? "";
        api
          .getResume()
          .then((resume: ResumeData) => {
            if (!cancelled) setForm(seedFromResume(resume.profile, authFullName, authEmail));
          })
          .catch(() => {
            if (!cancelled) setForm(seedFromResume(undefined, authFullName, authEmail));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  function addSkill() {
    const value = skillDraft.trim();
    if (!value || form.skills.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    setForm((current) => ({ ...current, skills: [...current.skills, value] }));
    setSkillDraft("");
  }

  function addRole() {
    const value = roleDraft.trim();
    if (!value || form.targetRoles.some((r) => r.toLowerCase() === value.toLowerCase())) return;
    setForm((current) => ({ ...current, targetRoles: [...current.targetRoles, value] }));
    setRoleDraft("");
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const payload: ProfilePayload = {
      full_name: form.fullName.trim() || null,
      contact_email: form.contactEmail.trim() || null,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      headline: form.headline.trim() || null,
      skills: form.skills,
      years_experience: form.yearsExperience ? Number(form.yearsExperience) : null,
      target_roles: form.targetRoles,
      salary_low: form.salaryLow ? Number(form.salaryLow) : null,
      salary_high: form.salaryHigh ? Number(form.salaryHigh) : null,
      salary_currency: form.salaryCurrency,
      linkedin_url: form.linkedinUrl.trim() || null,
      portfolio_url: form.portfolioUrl.trim() || null,
    };
    try {
      await profileApi.upsert(user.id, payload);
      setSaved(true);
      window.setTimeout(() => router.push("/dashboard"), 500);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save profile");
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container">
        <Loader label="Loading your profile…" />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
      <div className="page-head">
        <div className="page-kicker">(01) // CANDIDATE_PROFILE</div>
        <h1>{isWelcome ? "You're all set! Let's get your profile right" : "Edit your profile"}</h1>
        <p>
          {isWelcome
            ? "We pre-filled what we could from your résumé. Fix anything that's off, and fill in the rest."
            : "Keep this up to date — it's what employers see about you beyond your résumé."}
        </p>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Basics</h2>
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Contact email</label>
            <input
              className="input"
              value={form.contactEmail}
              onChange={(e) => setForm((c) => ({ ...c, contactEmail: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label>Headline</label>
          <input
            className="input"
            value={form.headline}
            onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
            placeholder="e.g. Senior Product Designer"
          />
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Skills & targets</h2>
        <div className="field">
          <label>Skills</label>
          <div className="tag-input-row">
            <input
              className="input"
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. React, Figma, SQL"
            />
            <button className="btn btn-ghost" onClick={addSkill}>
              Add
            </button>
          </div>
          <div className="tag-chip-list">
            {form.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
                <button
                  onClick={() =>
                    setForm((c) => ({ ...c, skills: c.skills.filter((s) => s !== skill) }))
                  }
                  aria-label={`Remove ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Target roles</label>
          <div className="tag-input-row">
            <input
              className="input"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole();
                }
              }}
              placeholder="e.g. Senior Backend Engineer"
            />
            <button className="btn btn-ghost" onClick={addRole}>
              Add
            </button>
          </div>
          <div className="tag-chip-list">
            {form.targetRoles.map((role) => (
              <span className="chip" key={role}>
                {role}
                <button
                  onClick={() =>
                    setForm((c) => ({ ...c, targetRoles: c.targetRoles.filter((r) => r !== role) }))
                  }
                  aria-label={`Remove ${role}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Years of experience</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.yearsExperience}
            onChange={(e) => setForm((c) => ({ ...c, yearsExperience: e.target.value }))}
          />
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Compensation</h2>
        <div className="field">
          <label>Salary expectation ({form.salaryCurrency})</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={form.salaryLow}
              onChange={(e) => setForm((c) => ({ ...c, salaryLow: e.target.value }))}
              placeholder="Low"
            />
            <span>–</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={form.salaryHigh}
              onChange={(e) => setForm((c) => ({ ...c, salaryHigh: e.target.value }))}
              placeholder="High"
            />
          </div>
        </div>
        <div className="field">
          <label>Currency</label>
          <select
            className="input"
            value={form.salaryCurrency}
            onChange={(e) => setForm((c) => ({ ...c, salaryCurrency: e.target.value }))}
          >
            <option>MYR</option>
            <option>USD</option>
            <option>SGD</option>
          </select>
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1.5rem" }}>
        <h2>Links</h2>
        <div className="form-grid">
          <div className="field">
            <label>LinkedIn</label>
            <input
              className="input"
              value={form.linkedinUrl}
              onChange={(e) => setForm((c) => ({ ...c, linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div className="field">
            <label>Portfolio</label>
            <input
              className="input"
              value={form.portfolioUrl}
              onChange={(e) => setForm((c) => ({ ...c, portfolioUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>
        </div>
      </div>

      <div className="hero-ctas">
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save & continue"}
        </button>
        <button className="btn btn-ghost" onClick={() => router.push("/dashboard")}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no output

- [ ] **Step 3: Lint**

Run: `npx eslint app/profile/page.tsx`
Expected: no output

- [ ] **Step 4: Commit**

```bash
git add app/profile/page.tsx
git commit -m "feat: add candidate profile page"
```

---

### Task 6: Nav link

**Files:**
- Modify: `components/Nav.tsx`

- [ ] **Step 1: Add PROFILE to APP_LINKS**

Find this block (candidate nav links array):

```typescript
const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/tracker", label: "JOB_TRACKER" },
  { href: "/evaluate", label: "EVALUATE" },
```

Change it to:

```typescript
const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/profile", label: "PROFILE" },
  { href: "/tracker", label: "JOB_TRACKER" },
  { href: "/evaluate", label: "EVALUATE" },
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint components/Nav.tsx`
Expected: no output from either command

- [ ] **Step 3: Commit**

```bash
git add components/Nav.tsx
git commit -m "feat: add profile link to candidate nav"
```

---

### Task 7: Onboarding redirect for new candidates

**Files:**
- Modify: `app/onboarding/page.tsx`

- [ ] **Step 1: Change the new-candidate success CTA**

Find this block inside the `done` state's JSX:

```tsx
        <div className="hero-ctas" style={{ paddingBottom: "3rem" }}>
          <button className="btn btn-primary" onClick={() => router.push(isNewUser ? "/dashboard" : "/evaluate")}>
            {isNewUser ? "Go to Dashboard" : "Evaluate your first job"}
          </button>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>
            Replace resume
          </button>
        </div>
```

Replace it with:

```tsx
        <div className="hero-ctas" style={{ paddingBottom: "3rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => router.push(isNewUser ? "/profile?welcome=1" : "/evaluate")}
          >
            {isNewUser ? "Review your profile →" : "Evaluate your first job"}
          </button>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>
            Replace resume
          </button>
        </div>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/onboarding/page.tsx`
Expected: no output from either command

- [ ] **Step 3: Commit**

```bash
git add app/onboarding/page.tsx
git commit -m "feat: route new candidates to profile review after resume upload"
```

---

### Task 8: Cross-link from My Résumé

**Files:**
- Modify: `app/my-resume/page.tsx`

- [ ] **Step 1: Add an Edit profile link**

Find this block:

```tsx
        <div className="page-head my-resume-head">
          <div>
            <div className="page-kicker">(01) // YOUR_RESUME</div>
            <h1>Your résumé</h1>
            <p>
              {headline
                ? `On file as “${headline}”. This is the single source of truth for every evaluation.`
                : "This is the single source of truth Aura matches every job against."}
            </p>
          </div>
          <Link href="/onboarding" className="btn btn-primary">
            Upload new résumé →
          </Link>
        </div>
```

Replace it with:

```tsx
        <div className="page-head my-resume-head">
          <div>
            <div className="page-kicker">(01) // YOUR_RESUME</div>
            <h1>Your résumé</h1>
            <p>
              {headline
                ? `On file as “${headline}”. This is the single source of truth for every evaluation.`
                : "This is the single source of truth Aura matches every job against."}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.65rem" }}>
            <Link href="/profile" className="btn btn-ghost">
              Edit profile
            </Link>
            <Link href="/onboarding" className="btn btn-primary">
              Upload new résumé →
            </Link>
          </div>
        </div>
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/my-resume/page.tsx`
Expected: no output from either command

- [ ] **Step 3: Commit**

```bash
git add app/my-resume/page.tsx
git commit -m "feat: link to profile from My Résumé page"
```

---

### Task 9: Manual end-to-end verification

**Blocked until the user has applied `supabase/migrations/20260725120000_candidate_profiles.sql`.**

- [ ] **Step 1:** Sign in as a candidate with no `candidate_profiles` row and no résumé on file. Visit `/profile` directly. Expected: form loads empty except full name/email pre-filled from the auth session; no console errors about a missing résumé (404 is caught silently).
- [ ] **Step 2:** Upload a résumé via `/onboarding`. Expected: success screen shows "Review your profile →" (not "Go to Dashboard") for a new candidate.
- [ ] **Step 3:** Click it. Expected: lands on `/profile?welcome=1`, heading reads the welcome copy, headline/skills/target roles are pre-filled from the parsed résumé if the parser returned those keys.
- [ ] **Step 4:** Edit a field, add a skill, click "Save & continue". Expected: redirects to `/dashboard`.
- [ ] **Step 5:** Revisit `/profile` from the nav (`PROFILE` link). Expected: heading reads "Edit your profile" (no welcome copy), saved values persist, no re-seeding from résumé occurs.
- [ ] **Step 6:** Upload a different résumé via `/my-resume` → "Upload new résumé →". Expected: after upload, still redirects to `/evaluate` (existing behavior), not `/profile`. Revisit `/profile` afterward — expected: earlier saved values are unchanged (no silent overwrite from the new résumé).
- [ ] **Step 7:** From `/my-resume`, click the new "Edit profile" link. Expected: navigates to `/profile`.

---

## Self-review notes

- **Spec coverage:** §2 data model → Task 1. §3 pre-fill → Task 5 (`formFromProfile`/`seedFromResume`). §4 onboarding change → Task 7. §5 page structure → Task 5 (all four sections), Task 6 (nav), Task 8 (my-resume cross-link). §6 out-of-scope items are simply not built. §7 testing → Task 9.
- **No unit tests for `lib/profileHelpers.ts`:** per spec §7, this is intentional — no complex pure logic to isolate (unlike the bounty feature's prize-math helpers).
