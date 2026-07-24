# Bounty Reward Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let employers post paid bounties (marketing content, testing, bug fixes, etc.), let candidates submit entries against a structured checklist, let employers pick winners and record cash prizes, and surface every submission — win or lose — as skill evidence anywhere a candidate is viewed.

**Architecture:** Three new Supabase tables (`bounties`, `bounty_submissions`, `bounty_submission_results`) plus a private Storage bucket, all driven directly from Next.js via `supabase-js` — no FastAPI backend involvement. Postgres RLS is the entire authorization layer. New `lib/bountyHelpers.ts` (pure types/logic, unit-tested) and `lib/bountyApi.ts` (Supabase-backed CRUD) mirror the existing `lib/employerApi.ts` pattern. New UI lives under `/bounties` (public marketplace + candidate submission) and `/employer/bounties` (employer creation, management, review), reusing existing global CSS classes (`panel`, `chip`, `field`, `input`, `employer-page`, etc.) and component patterns (`JobEditor`'s multi-section form). Winner outreach uses a new standalone `BountyContactButton` (mailto-based) rather than the real `CandidateEmailComposer`, which turned out mid-implementation to be backend-integrated infrastructure unrelated to bounties — see Task 10.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (Postgres + RLS + Storage), plain global CSS + CSS Modules (no Tailwind in these components), `node:test` for pure-logic unit tests.

**Spec:** `docs/superpowers/specs/2026-07-24-bounty-reward-mechanism-design.md`

**One deviation from the spec, decided during planning:** the spec's `bounty_submissions` table didn't include a way to identify who submitted. The employer-side review UI needs a name/email to show per submission, and the existing codebase deliberately proxies *all* candidate PII (name, email) through the FastAPI backend rather than exposing it via direct Supabase reads — `users` table RLS almost certainly restricts reads to a caller's own row, matching normal privacy practice. Rather than depend on unverified cross-table access, this plan adds `contact_name` and `contact_email` as required text fields captured directly on the submission (the candidate types their own contact info), the same "free text, no account lookup" approach already chosen for team members. This keeps the whole feature self-contained in the new tables with no dependency on `users` table shape beyond the already-confirmed `id`/`role` columns.

**Also note:** the spec's storage RLS assumed the marketplace could show an employer's company name on bounty cards. This plan does not join to any employer-profile table for that (schema/RLS unverified for anonymous reads), so bounty cards and the marketplace show bounty details only, no employer branding. This can be added later once that table's shape is confirmed.

**Note on `RouteGuard`:** no changes needed. Reading `components/RouteGuard.tsx` closely: routes are only gated if they match `isEmployerRoute` (`/employer*`) or `isCandidateRoute` (a fixed list of prefixes). `/bounties` matches neither, so it already renders for anyone, logged in or not — exactly the public-marketplace behavior this feature needs. Do not add `/bounties` to `isCandidateRoute` or the marketplace will break.

---

### Task 1: Database schema

**Files:**
- Create: `supabase/migrations/20260724120000_bounty_reward_mechanism.sql`

This task produces a SQL file only. **It is not applied by this plan** — the Supabase MCP connector available in this environment is authorized against a different project than the one this app uses (`NEXT_PUBLIC_SUPABASE_URL` in `.env.local`). The user runs this file themselves via the Supabase Dashboard SQL editor or `supabase db push` before Task 6 onward will work end-to-end (Tasks 1–4 don't require the schema to exist yet, since they don't touch the database).

- [ ] **Step 1: Write the migration**

```sql
-- Bounty Reward Mechanism
-- Run this against the Supabase project this app points to
-- (NEXT_PUBLIC_SUPABASE_URL in .env.local) via the SQL editor or `supabase db push`.
-- Assumes a `public.users` table already exists with `id uuid primary key`
-- and a `role` text column ('employer' | 'candidate') — confirmed present,
-- used by components/AuthProvider.tsx today.

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid not null references public.users(id),
  title text not null,
  tags text[] not null default '{}',
  rules_text text,
  requirement_items jsonb not null default '[]',
  submission_mode text not null default 'individual'
    check (submission_mode in ('individual', 'team', 'both')),
  winner_slots jsonb not null default '[]',
  currency text not null default 'USD',
  deadline timestamptz,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'closed', 'winners_announced')),
  published_at timestamptz,
  closed_at timestamptz,
  winners_announced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bounties_employer_id_idx on public.bounties (employer_id);
create index if not exists bounties_status_idx on public.bounties (status);

create table if not exists public.bounty_submissions (
  id uuid primary key default gen_random_uuid(),
  bounty_id uuid not null references public.bounties(id) on delete cascade,
  candidate_user_id uuid not null references public.users(id),
  contact_name text not null,
  contact_email text not null,
  team_members jsonb not null default '[]',
  responses jsonb not null default '{}',
  notes text,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bounty_id, candidate_user_id)
);

create index if not exists bounty_submissions_bounty_id_idx on public.bounty_submissions (bounty_id);
create index if not exists bounty_submissions_candidate_id_idx on public.bounty_submissions (candidate_user_id);

create table if not exists public.bounty_submission_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.bounty_submissions(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'winner', 'not_selected')),
  rank integer,
  prize_amount numeric,
  contacted_at timestamptz,
  decided_at timestamptz
);

alter table public.bounties enable row level security;
alter table public.bounty_submissions enable row level security;
alter table public.bounty_submission_results enable row level security;

-- bounties --------------------------------------------------------------

create policy "bounties_select_published_or_own" on public.bounties
  for select
  using (
    status = 'published'
    or employer_id = auth.uid()
  );

create policy "bounties_insert_own_employer" on public.bounties
  for insert
  to authenticated
  with check (
    employer_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'employer')
  );

create policy "bounties_update_own" on public.bounties
  for update
  to authenticated
  using (employer_id = auth.uid())
  with check (employer_id = auth.uid());

create policy "bounties_delete_own" on public.bounties
  for delete
  to authenticated
  using (employer_id = auth.uid());

-- bounty_submissions ------------------------------------------------------

create policy "submissions_select_own_owner_or_employer" on public.bounty_submissions
  for select
  using (
    candidate_user_id = auth.uid()
    or exists (
      select 1 from public.bounties b
      where b.id = bounty_submissions.bounty_id and b.employer_id = auth.uid()
    )
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'employer')
  );

create policy "submissions_insert_own_candidate" on public.bounty_submissions
  for insert
  to authenticated
  with check (
    candidate_user_id = auth.uid()
    and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'candidate')
    and exists (
      select 1 from public.bounties b
      where b.id = bounty_submissions.bounty_id
        and b.status = 'published'
        and (b.deadline is null or now() < b.deadline)
    )
  );

create policy "submissions_update_own_candidate" on public.bounty_submissions
  for update
  to authenticated
  using (candidate_user_id = auth.uid())
  with check (
    candidate_user_id = auth.uid()
    and exists (
      select 1 from public.bounties b
      where b.id = bounty_submissions.bounty_id
        and b.status = 'published'
        and (b.deadline is null or now() < b.deadline)
    )
  );

-- bounty_submission_results -----------------------------------------------

create policy "results_select_same_as_submissions" on public.bounty_submission_results
  for select
  using (
    exists (
      select 1 from public.bounty_submissions s
      where s.id = bounty_submission_results.submission_id
        and (
          s.candidate_user_id = auth.uid()
          or exists (select 1 from public.bounties b where b.id = s.bounty_id and b.employer_id = auth.uid())
        )
    )
    or exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'employer')
  );

create policy "results_insert_bounty_owner" on public.bounty_submission_results
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()
    )
  );

create policy "results_update_bounty_owner" on public.bounty_submission_results
  for update
  to authenticated
  using (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()
    )
  );

-- storage -------------------------------------------------------------------
-- Path convention: {bounty_id}/{candidate_user_id}/{requirement_item_id}-{filename}

insert into storage.buckets (id, name, public)
values ('bounty-submissions', 'bounty-submissions', false)
on conflict (id) do nothing;

create policy "bounty_files_select_owner_or_employer" on storage.objects
  for select
  using (
    bucket_id = 'bounty-submissions'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or exists (
        select 1 from public.bounties b
        where b.id::text = (storage.foldername(name))[1]
          and b.employer_id = auth.uid()
      )
    )
  );

create policy "bounty_files_write_owner" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'bounty-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "bounty_files_update_owner" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'bounty-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "bounty_files_delete_owner" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'bounty-submissions'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
```

- [ ] **Step 2: Hand off to the user**

Tell the user: "Run `supabase/migrations/20260724120000_bounty_reward_mechanism.sql` against your Supabase project (SQL editor or `supabase db push`) before testing anything past Task 6 — the app will 404/error on bounty data until this schema exists." Do not attempt to run it yourself.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260724120000_bounty_reward_mechanism.sql
git commit -m "feat: add bounty reward mechanism database schema"
```

---

### Task 2: Bounty pure types & helpers

**Files:**
- Create: `lib/bountyHelpers.ts`
- Test: `lib/bountyHelpers.test.mjs`

Kept separate from `lib/bountyApi.ts` deliberately: `lib/supabaseClient.ts` calls `createClient()` at module load, which throws synchronously (`"supabaseUrl is required"`) when env vars aren't loaded — which they aren't when running `node --test` directly outside Next.js. Importing anything that transitively imports `supabaseClient.ts` breaks the test runner. This file has zero I/O, so it's safe to import standalone (same reason `lib/sse.ts` is tested this way already).

- [ ] **Step 1: Write the failing test**

```js
// lib/bountyHelpers.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import {
  totalPrizePool,
  formatPrize,
  bountyStatusLabel,
  nextOpenRank,
  isSubmissionComplete,
} from "./bountyHelpers.ts";

test("totalPrizePool sums all winner slot amounts", () => {
  assert.equal(
    totalPrizePool([
      { rank: 1, prize_amount: 500 },
      { rank: 2, prize_amount: 300 },
      { rank: 3, prize_amount: 200 },
    ]),
    1000,
  );
});

test("totalPrizePool returns 0 for no slots", () => {
  assert.equal(totalPrizePool([]), 0);
});

test("formatPrize formats currency and amount", () => {
  assert.equal(formatPrize(1500, "USD"), "USD 1,500");
});

test("bountyStatusLabel maps every status to a label", () => {
  assert.equal(bountyStatusLabel("draft"), "Draft");
  assert.equal(bountyStatusLabel("published"), "Published");
  assert.equal(bountyStatusLabel("closed"), "Closed");
  assert.equal(bountyStatusLabel("winners_announced"), "Winners announced");
});

test("nextOpenRank returns the lowest rank without a winner", () => {
  const slots = [
    { rank: 1, prize_amount: 500 },
    { rank: 2, prize_amount: 300 },
    { rank: 3, prize_amount: 200 },
  ];
  const results = [
    { id: "r1", submission_id: "s1", status: "winner", rank: 1, prize_amount: 500, contacted_at: null, decided_at: null },
  ];
  assert.equal(nextOpenRank(slots, results), 2);
});

test("nextOpenRank returns null when all ranks are taken", () => {
  const slots = [{ rank: 1, prize_amount: 500 }];
  const results = [
    { id: "r1", submission_id: "s1", status: "winner", rank: 1, prize_amount: 500, contacted_at: null, decided_at: null },
  ];
  assert.equal(nextOpenRank(slots, results), null);
});

test("isSubmissionComplete requires every required item to have a non-empty response", () => {
  const items = [
    { id: "a", label: "Design file", description: "", type: "file", required: true },
    { id: "b", label: "Notes", description: "", type: "text", required: false },
  ];
  assert.equal(isSubmissionComplete(items, {}), false);
  assert.equal(
    isSubmissionComplete(items, { a: { type: "file", value: "path/to/file" } }),
    true,
  );
  assert.equal(
    isSubmissionComplete(items, { a: { type: "file", value: "  " } }),
    false,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --experimental-strip-types --test lib/bountyHelpers.test.mjs`
Expected: FAIL — `lib/bountyHelpers.ts` doesn't exist yet (`Cannot find module`).

- [ ] **Step 3: Write the implementation**

```ts
// lib/bountyHelpers.ts
export type RequirementType = "file" | "link" | "text";

export type RequirementItem = {
  id: string;
  label: string;
  description: string;
  type: RequirementType;
  required: boolean;
};

export type WinnerSlot = {
  rank: number;
  prize_amount: number;
};

export type SubmissionMode = "individual" | "team" | "both";
export type BountyStatus = "draft" | "published" | "closed" | "winners_announced";

export interface Bounty {
  id: string;
  employer_id: string;
  title: string;
  tags: string[];
  rules_text: string | null;
  requirement_items: RequirementItem[];
  submission_mode: SubmissionMode;
  winner_slots: WinnerSlot[];
  currency: string;
  deadline: string | null;
  status: BountyStatus;
  published_at: string | null;
  closed_at: string | null;
  winners_announced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamMember = { name: string; email: string };
export type RequirementResponse = { type: RequirementType; value: string };

export interface BountySubmission {
  id: string;
  bounty_id: string;
  candidate_user_id: string;
  contact_name: string;
  contact_email: string;
  team_members: TeamMember[];
  responses: Record<string, RequirementResponse>;
  notes: string | null;
  submitted_at: string;
  updated_at: string;
}

export type SubmissionResultStatus = "pending" | "winner" | "not_selected";

export interface SubmissionResult {
  id: string;
  submission_id: string;
  status: SubmissionResultStatus;
  rank: number | null;
  prize_amount: number | null;
  contacted_at: string | null;
  decided_at: string | null;
}

export type SubmissionWithResult = BountySubmission & { result: SubmissionResult | null };

export type CandidateBountyHistory = {
  submission: BountySubmission;
  bounty: Pick<Bounty, "id" | "title" | "currency">;
  result: SubmissionResult | null;
};

export type BountyEditorMode = "create" | "edit";

export type BountyPayload = Partial<
  Pick<
    Bounty,
    | "title"
    | "tags"
    | "rules_text"
    | "requirement_items"
    | "submission_mode"
    | "winner_slots"
    | "currency"
    | "deadline"
  >
>;

export type SubmissionPayload = {
  contact_name: string;
  contact_email: string;
  team_members: TeamMember[];
  responses: Record<string, RequirementResponse>;
  notes: string;
};

export function totalPrizePool(winnerSlots: WinnerSlot[]): number {
  return winnerSlots.reduce((total, slot) => total + slot.prize_amount, 0);
}

export function formatPrize(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function bountyStatusLabel(status: BountyStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "closed":
      return "Closed";
    case "winners_announced":
      return "Winners announced";
  }
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "No deadline";
  const deadline = new Date(iso).getTime();
  const now = Date.now();
  if (deadline <= now) return "Deadline passed";
  const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  return days <= 1 ? "Closes in 1 day" : `Closes in ${days} days`;
}

export function nextOpenRank(
  winnerSlots: WinnerSlot[],
  results: SubmissionResult[],
): number | null {
  const takenRanks = new Set(
    results.filter((r) => r.status === "winner" && r.rank != null).map((r) => r.rank),
  );
  const sorted = [...winnerSlots].sort((a, b) => a.rank - b.rank);
  const open = sorted.find((slot) => !takenRanks.has(slot.rank));
  return open ? open.rank : null;
}

export function isSubmissionComplete(
  items: RequirementItem[],
  responses: Record<string, RequirementResponse>,
): boolean {
  return items
    .filter((item) => item.required)
    .every((item) => {
      const response = responses[item.id];
      return Boolean(response && response.value.trim().length > 0);
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types --test lib/bountyHelpers.test.mjs`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add lib/bountyHelpers.ts lib/bountyHelpers.test.mjs
git commit -m "feat: add bounty pure types and helper functions"
```

---

### Task 3: Bounty Supabase API client

**Files:**
- Create: `lib/bountyApi.ts`

No automated tests for this file — same convention as `lib/employerApi.ts` (which also has none): it's a thin wrapper over network calls (here, `supabase-js` instead of `fetch`), verified manually once the UI that calls it exists (Tasks 6–12).

- [ ] **Step 1: Write the implementation**

```ts
// lib/bountyApi.ts
/**
 * Bounty API client. Talks directly to Supabase (tables + storage), not the
 * /api/backend FastAPI proxy — access control is enforced entirely by
 * Postgres RLS (see supabase/migrations/20260724120000_bounty_reward_mechanism.sql).
 */
import { supabase } from "./supabaseClient";
import type {
  Bounty,
  BountyPayload,
  BountySubmission,
  CandidateBountyHistory,
  SubmissionPayload,
  SubmissionResult,
  SubmissionWithResult,
} from "./bountyHelpers";

export * from "./bountyHelpers";

export const bountyApi = {
  listPublished: async (tag?: string): Promise<Bounty[]> => {
    let query = supabase
      .from("bounties")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    if (tag) query = query.contains("tags", [tag]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as Bounty[];
  },

  listMine: async (employerId: string): Promise<Bounty[]> => {
    const { data, error } = await supabase
      .from("bounties")
      .select("*")
      .eq("employer_id", employerId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as Bounty[];
  },

  getById: async (id: string): Promise<Bounty | null> => {
    const { data, error } = await supabase.from("bounties").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data as Bounty | null;
  },

  create: async (employerId: string, payload: BountyPayload): Promise<Bounty> => {
    const { data, error } = await supabase
      .from("bounties")
      .insert({ ...payload, employer_id: employerId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Bounty;
  },

  update: async (id: string, payload: BountyPayload): Promise<Bounty> => {
    const { data, error } = await supabase
      .from("bounties")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Bounty;
  },

  publish: async (id: string): Promise<Bounty> => {
    const { data, error } = await supabase
      .from("bounties")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Bounty;
  },

  close: async (id: string): Promise<Bounty> => {
    const { data, error } = await supabase
      .from("bounties")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as Bounty;
  },

  deleteDraft: async (id: string): Promise<void> => {
    const { error } = await supabase.from("bounties").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  announceWinners: async (bountyId: string): Promise<void> => {
    const { data: submissions, error: subError } = await supabase
      .from("bounty_submissions")
      .select("id")
      .eq("bounty_id", bountyId);
    if (subError) throw new Error(subError.message);
    const submissionIds = (submissions ?? []).map((s) => s.id as string);

    if (submissionIds.length > 0) {
      const { data: existingResults, error: resError } = await supabase
        .from("bounty_submission_results")
        .select("submission_id, status")
        .in("submission_id", submissionIds);
      if (resError) throw new Error(resError.message);

      const winnerIds = new Set(
        (existingResults ?? [])
          .filter((r) => r.status === "winner")
          .map((r) => r.submission_id as string),
      );
      const toMarkNotSelected = submissionIds.filter((id) => !winnerIds.has(id));

      if (toMarkNotSelected.length > 0) {
        const { error: upsertError } = await supabase.from("bounty_submission_results").upsert(
          toMarkNotSelected.map((submission_id) => ({
            submission_id,
            status: "not_selected" as const,
            decided_at: new Date().toISOString(),
          })),
          { onConflict: "submission_id" },
        );
        if (upsertError) throw new Error(upsertError.message);
      }
    }

    const { error: bountyError } = await supabase
      .from("bounties")
      .update({ status: "winners_announced", winners_announced_at: new Date().toISOString() })
      .eq("id", bountyId);
    if (bountyError) throw new Error(bountyError.message);
  },

  getMySubmission: async (
    bountyId: string,
    candidateUserId: string,
  ): Promise<BountySubmission | null> => {
    const { data, error } = await supabase
      .from("bounty_submissions")
      .select("*")
      .eq("bounty_id", bountyId)
      .eq("candidate_user_id", candidateUserId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as BountySubmission | null;
  },

  upsertSubmission: async (
    bountyId: string,
    candidateUserId: string,
    payload: SubmissionPayload,
  ): Promise<BountySubmission> => {
    const { data, error } = await supabase
      .from("bounty_submissions")
      .upsert(
        {
          bounty_id: bountyId,
          candidate_user_id: candidateUserId,
          ...payload,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "bounty_id,candidate_user_id" },
      )
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as BountySubmission;
  },

  uploadSubmissionFile: async (
    bountyId: string,
    candidateUserId: string,
    requirementItemId: string,
    file: File,
  ): Promise<string> => {
    const path = `${bountyId}/${candidateUserId}/${requirementItemId}-${file.name}`;
    const { error } = await supabase.storage
      .from("bounty-submissions")
      .upload(path, file, { upsert: true });
    if (error) throw new Error(error.message);
    return path;
  },

  getSignedFileUrl: async (path: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from("bounty-submissions")
      .createSignedUrl(path, 600);
    if (error) throw new Error(error.message);
    return data.signedUrl;
  },

  listSubmissionsForBounty: async (bountyId: string): Promise<SubmissionWithResult[]> => {
    const { data: submissions, error } = await supabase
      .from("bounty_submissions")
      .select("*")
      .eq("bounty_id", bountyId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (submissions ?? []) as BountySubmission[];
    if (rows.length === 0) return [];

    const { data: results, error: resultsError } = await supabase
      .from("bounty_submission_results")
      .select("*")
      .in("submission_id", rows.map((r) => r.id));
    if (resultsError) throw new Error(resultsError.message);
    const resultsBySubmission = new Map(
      (results ?? []).map((r) => [r.submission_id as string, r as SubmissionResult]),
    );

    return rows.map((submission) => ({
      ...submission,
      result: resultsBySubmission.get(submission.id) ?? null,
    }));
  },

  markWinner: async (submissionId: string, rank: number, prizeAmount: number): Promise<void> => {
    const { error } = await supabase.from("bounty_submission_results").upsert(
      {
        submission_id: submissionId,
        status: "winner",
        rank,
        prize_amount: prizeAmount,
        decided_at: new Date().toISOString(),
      },
      { onConflict: "submission_id" },
    );
    if (error) throw new Error(error.message);
  },

  removeWinner: async (submissionId: string): Promise<void> => {
    const { error } = await supabase.from("bounty_submission_results").upsert(
      {
        submission_id: submissionId,
        status: "pending",
        rank: null,
        prize_amount: null,
        decided_at: null,
      },
      { onConflict: "submission_id" },
    );
    if (error) throw new Error(error.message);
  },

  markContacted: async (submissionId: string): Promise<void> => {
    const { error } = await supabase
      .from("bounty_submission_results")
      .update({ contacted_at: new Date().toISOString() })
      .eq("submission_id", submissionId);
    if (error) throw new Error(error.message);
  },

  listCandidateHistory: async (candidateUserId: string): Promise<CandidateBountyHistory[]> => {
    const { data: submissions, error } = await supabase
      .from("bounty_submissions")
      .select("*, bounties(id, title, currency)")
      .eq("candidate_user_id", candidateUserId)
      .order("submitted_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (submissions ?? []) as (BountySubmission & {
      bounties: Pick<Bounty, "id" | "title" | "currency"> | null;
    })[];
    if (rows.length === 0) return [];

    const { data: results, error: resultsError } = await supabase
      .from("bounty_submission_results")
      .select("*")
      .in("submission_id", rows.map((r) => r.id));
    if (resultsError) throw new Error(resultsError.message);
    const resultsBySubmission = new Map(
      (results ?? []).map((r) => [r.submission_id as string, r as SubmissionResult]),
    );

    return rows
      .filter(
        (row): row is typeof row & { bounties: Pick<Bounty, "id" | "title" | "currency"> } =>
          row.bounties != null,
      )
      .map((row) => ({
        submission: row,
        bounty: row.bounties,
        result: resultsBySubmission.get(row.id) ?? null,
      }));
  },
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors attributable to `lib/bountyApi.ts` (pre-existing unrelated errors, if any, are out of scope — this is the "no NEW problems in files I touched" baseline rule).

- [ ] **Step 3: Commit**

```bash
git add lib/bountyApi.ts
git commit -m "feat: add Supabase-backed bounty API client"
```

---

### Task 4: Nav links

**Files:**
- Modify: `components/Nav.tsx:12-25`

- [ ] **Step 1: Add BOUNTIES to both link sets**

In `components/Nav.tsx`, change:

```ts
const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/tracker", label: "JOB_TRACKER" },
  { href: "/evaluate", label: "EVALUATE" },
  { href: "/worth", label: "YOUR_WORTH" },
  { href: "/insights", label: "INSIGHTS" },
  { href: "/jobs", label: "FIND_JOBS" },
  { href: "/compare", label: "COMPARE" },
  { href: "/scan", label: "SCAN_JOBS" },
  { href: "/mock-interview", label: "MOCK_INTERVIEW" },
];

const EMPLOYER_LINKS = [
  { href: '/employer', label: 'OVERVIEW' },
  { href: '/employer/candidates', label: 'CANDIDATES' },
  { href: '/employer/jobs', label: 'JOBS' },
  { href: '/employer/interviews', label: 'INTERVIEWS' },
];
```

to:

```ts
const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/tracker", label: "JOB_TRACKER" },
  { href: "/evaluate", label: "EVALUATE" },
  { href: "/worth", label: "YOUR_WORTH" },
  { href: "/insights", label: "INSIGHTS" },
  { href: "/jobs", label: "FIND_JOBS" },
  { href: "/bounties", label: "BOUNTIES" },
  { href: "/compare", label: "COMPARE" },
  { href: "/scan", label: "SCAN_JOBS" },
  { href: "/mock-interview", label: "MOCK_INTERVIEW" },
];

const EMPLOYER_LINKS = [
  { href: '/employer', label: 'OVERVIEW' },
  { href: '/employer/candidates', label: 'CANDIDATES' },
  { href: '/employer/jobs', label: 'JOBS' },
  { href: '/employer/bounties', label: 'BOUNTIES' },
  { href: '/employer/interviews', label: 'INTERVIEWS' },
];
```

- [ ] **Step 2: Manual verification**

Run: `npm run dev`, visit `/` logged out. Expected: no crash (the nav link array change is inert until routes exist — full verification happens in Task 13).

- [ ] **Step 3: Commit**

```bash
git add components/Nav.tsx
git commit -m "feat: add bounty links to candidate and employer nav"
```

---

### Task 5: Employer bounty editor components

**Files:**
- Create: `components/employer/bounty-editor/types.ts`
- Create: `components/employer/bounty-editor/DetailsSection.tsx`
- Create: `components/employer/bounty-editor/RequirementsSection.tsx`
- Create: `components/employer/bounty-editor/PrizesSection.tsx`
- Create: `components/employer/bounty-editor/SettingsSection.tsx`
- Create: `components/employer/bounty-editor/BountyEditor.tsx`
- Create: `components/employer/bounty-editor/BountyEditor.module.css`
- Create: `components/employer/bounty-editor/index.ts`

Mirrors `components/employer/job-editor/`'s multi-section pattern (`JobEditor.tsx` orchestrates section components, each importing a shared CSS Module).

- [ ] **Step 1: Types**

```ts
// components/employer/bounty-editor/types.ts
export type BountyDetails = {
  title: string;
  tags: string[];
  rulesText: string;
};
```

- [ ] **Step 2: Details section**

```tsx
// components/employer/bounty-editor/DetailsSection.tsx
import styles from "./BountyEditor.module.css";
import type { BountyDetails } from "./types";

export default function DetailsSection({
  details,
  tagDraft,
  onDetailsChange,
  onTagDraftChange,
  onTagAdd,
  onTagRemove,
}: {
  details: BountyDetails;
  tagDraft: string;
  onDetailsChange: (patch: Partial<BountyDetails>) => void;
  onTagDraftChange: (value: string) => void;
  onTagAdd: () => void;
  onTagRemove: (tag: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Bounty details</h2>
      <p className={styles.sectionHint}>
        The title and brief candidates see on the public marketplace.
      </p>
      <div className="field">
        <label>Title</label>
        <input
          className="input"
          value={details.title}
          onChange={(event) => onDetailsChange({ title: event.target.value })}
          placeholder="e.g. Launch week bug bash"
        />
      </div>
      <div className="field">
        <label>Tags</label>
        <div className={styles.tagEditor}>
          <div className={styles.tagInput}>
            <input
              className="input"
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onTagAdd();
                }
              }}
              placeholder="e.g. Marketing, QA, Design"
            />
            <button className="btn btn-ghost" onClick={onTagAdd}>
              Add
            </button>
          </div>
          <div className={styles.tags}>
            {details.tags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
                <button onClick={() => onTagRemove(tag)} aria-label={`Remove ${tag}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="field">
        <label>Brief and rules</label>
        <textarea
          className="input"
          value={details.rulesText}
          onChange={(event) => onDetailsChange({ rulesText: event.target.value })}
          placeholder="What are candidates building, and what does a winning submission look like?"
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Requirements section**

```tsx
// components/employer/bounty-editor/RequirementsSection.tsx
import styles from "./BountyEditor.module.css";
import type { RequirementItem, RequirementType } from "@/lib/bountyApi";

export default function RequirementsSection({
  requirements,
  onAdd,
  onChange,
  onRemove,
}: {
  requirements: RequirementItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<RequirementItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Submission requirements</h2>
      <p className={styles.sectionHint}>
        Each item becomes its own field on the candidate submission form.
      </p>
      <div className={styles.requirementList}>
        {requirements.map((item) => (
          <div className={styles.requirementRow} key={item.id}>
            <input
              className="input"
              value={item.label}
              onChange={(event) => onChange(item.id, { label: event.target.value })}
              placeholder="Requirement label"
            />
            <input
              className="input"
              value={item.description}
              onChange={(event) => onChange(item.id, { description: event.target.value })}
              placeholder="Instructions (optional)"
            />
            <select
              className="input"
              value={item.type}
              onChange={(event) =>
                onChange(item.id, { type: event.target.value as RequirementType })
              }
            >
              <option value="file">File</option>
              <option value="link">Link</option>
              <option value="text">Text</option>
            </select>
            <label className={styles.requiredToggle}>
              <input
                type="checkbox"
                checked={item.required}
                onChange={(event) => onChange(item.id, { required: event.target.checked })}
              />
              Required
            </label>
            <button
              className={styles.removeRow}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.label}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {requirements.length === 0 && <p className={styles.sectionHint}>No requirements yet.</p>}
      <button className={styles.addRow} onClick={onAdd}>
        ＋ Add requirement
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Prizes section**

```tsx
// components/employer/bounty-editor/PrizesSection.tsx
import styles from "./BountyEditor.module.css";
import { formatPrize, type WinnerSlot } from "@/lib/bountyApi";

export default function PrizesSection({
  currency,
  winnerSlots,
  totalPool,
  onCurrencyChange,
  onAdd,
  onRemove,
  onAmountChange,
}: {
  currency: string;
  winnerSlots: WinnerSlot[];
  totalPool: number;
  onCurrencyChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (rank: number) => void;
  onAmountChange: (rank: number, amount: number) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Prize pool</h2>
      <p className={styles.sectionHint}>
        Set a cash amount per rank. Total pool: {formatPrize(totalPool, currency)}
      </p>
      <div className="field">
        <label>Currency</label>
        <select
          className="input"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          <option>USD</option>
          <option>MYR</option>
          <option>SGD</option>
        </select>
      </div>
      <div className={styles.requirementList}>
        {winnerSlots.map((slot) => (
          <div className={styles.prizeRow} key={slot.rank}>
            <strong>Rank {slot.rank}</strong>
            <input
              className="input"
              type="number"
              min="0"
              step="10"
              value={slot.prize_amount}
              onChange={(event) => onAmountChange(slot.rank, Number(event.target.value))}
            />
            <button
              className={styles.removeRow}
              onClick={() => onRemove(slot.rank)}
              aria-label={`Remove rank ${slot.rank}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button className={styles.addRow} onClick={onAdd}>
        ＋ Add winner slot
      </button>
    </section>
  );
}
```

- [ ] **Step 5: Settings section**

```tsx
// components/employer/bounty-editor/SettingsSection.tsx
import type { SubmissionMode } from "@/lib/bountyApi";

export default function SettingsSection({
  submissionMode,
  deadline,
  onSubmissionModeChange,
  onDeadlineChange,
}: {
  submissionMode: SubmissionMode;
  deadline: string;
  onSubmissionModeChange: (value: SubmissionMode) => void;
  onDeadlineChange: (value: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Settings</h2>
      <div className="form-grid">
        <div className="field">
          <label>Who can submit</label>
          <select
            className="input"
            value={submissionMode}
            onChange={(event) => onSubmissionModeChange(event.target.value as SubmissionMode)}
          >
            <option value="individual">Individuals only</option>
            <option value="team">Teams only</option>
            <option value="both">Individuals or teams</option>
          </select>
        </div>
        <div className="field">
          <label>Deadline (optional)</label>
          <input
            className="input"
            type="date"
            value={deadline}
            onChange={(event) => onDeadlineChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Orchestrator**

```tsx
// components/employer/bounty-editor/BountyEditor.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  bountyApi,
  totalPrizePool,
  type Bounty,
  type BountyEditorMode,
  type RequirementItem,
  type SubmissionMode,
  type WinnerSlot,
} from "@/lib/bountyApi";
import DetailsSection from "./DetailsSection";
import RequirementsSection from "./RequirementsSection";
import PrizesSection from "./PrizesSection";
import SettingsSection from "./SettingsSection";
import type { BountyDetails } from "./types";
import styles from "./BountyEditor.module.css";

const emptyDetails: BountyDetails = {
  title: "",
  tags: [],
  rulesText: "",
};

function detailsFromBounty(bounty: Bounty): BountyDetails {
  return { title: bounty.title, tags: bounty.tags, rulesText: bounty.rules_text ?? "" };
}

export default function BountyEditor({
  mode,
  initialBounty,
}: {
  mode: BountyEditorMode;
  initialBounty?: Bounty;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [details, setDetails] = useState<BountyDetails>(
    initialBounty ? detailsFromBounty(initialBounty) : emptyDetails,
  );
  const [tagDraft, setTagDraft] = useState("");
  const [requirements, setRequirements] = useState<RequirementItem[]>(
    initialBounty?.requirement_items ?? [],
  );
  const [winnerSlots, setWinnerSlots] = useState<WinnerSlot[]>(
    initialBounty?.winner_slots ?? [{ rank: 1, prize_amount: 0 }],
  );
  const [currency, setCurrency] = useState(initialBounty?.currency ?? "USD");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(
    initialBounty?.submission_mode ?? "individual",
  );
  const [deadline, setDeadline] = useState(
    initialBounty?.deadline ? initialBounty.deadline.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = mode === "edit" && initialBounty?.status !== "draft";

  function addTag() {
    const value = tagDraft.trim();
    if (!value || details.tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    setDetails((current) => ({ ...current, tags: [...current.tags, value] }));
    setTagDraft("");
  }

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "New requirement",
        description: "",
        type: "text",
        required: true,
      },
    ]);
  }

  function addWinnerSlot() {
    setWinnerSlots((current) => [...current, { rank: current.length + 1, prize_amount: 0 }]);
  }

  function removeWinnerSlot(rank: number) {
    setWinnerSlots((current) =>
      current
        .filter((slot) => slot.rank !== rank)
        .map((slot, index) => ({ ...slot, rank: index + 1 })),
    );
  }

  async function save(publish: boolean) {
    if (!user) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: details.title.trim() || "Untitled bounty",
      tags: details.tags,
      rules_text: details.rulesText,
      requirement_items: requirements,
      submission_mode: submissionMode,
      winner_slots: winnerSlots,
      currency,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    };
    try {
      let bounty: Bounty;
      if (mode === "create") {
        bounty = await bountyApi.create(user.id, payload);
      } else {
        bounty = await bountyApi.update(initialBounty!.id, payload);
      }
      if (publish) {
        await bountyApi.publish(bounty.id);
      }
      setSaved(true);
      window.setTimeout(() => router.push("/employer/bounties"), 650);
    } catch (err) {
      console.error("Failed to save bounty:", err);
      setError(err instanceof Error ? err.message : "Failed to save bounty");
      setSaving(false);
    }
  }

  if (locked) {
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>This bounty is live</h3>
          <p>Published bounties can no longer be edited. Close it to make changes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">{mode === "create" ? "New bounty" : "Edit bounty"}</p>
          <h1>{mode === "create" ? "Create a bounty" : `Edit ${initialBounty?.title}`}</h1>
          <p>Define the brief, requirements, and prize pool, then publish to the marketplace.</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-ghost" onClick={() => router.push("/employer/bounties")}>
            Cancel
          </button>
          <button className="btn btn-ghost" disabled={saving} onClick={() => save(false)}>
            Save draft
          </button>
          <button
            className="btn btn-primary"
            disabled={saving || !details.title.trim() || winnerSlots.length === 0}
            onClick={() => save(true)}
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Publish"}
          </button>
        </div>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className={styles.layout}>
        <DetailsSection
          details={details}
          tagDraft={tagDraft}
          onDetailsChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
          onTagDraftChange={setTagDraft}
          onTagAdd={addTag}
          onTagRemove={(tag) =>
            setDetails((current) => ({
              ...current,
              tags: current.tags.filter((t) => t !== tag),
            }))
          }
        />
        <RequirementsSection
          requirements={requirements}
          onAdd={addRequirement}
          onChange={(id, patch) =>
            setRequirements((current) =>
              current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            )
          }
          onRemove={(id) =>
            setRequirements((current) => current.filter((item) => item.id !== id))
          }
        />
        <PrizesSection
          currency={currency}
          winnerSlots={winnerSlots}
          totalPool={totalPrizePool(winnerSlots)}
          onCurrencyChange={setCurrency}
          onAdd={addWinnerSlot}
          onRemove={removeWinnerSlot}
          onAmountChange={(rank, amount) =>
            setWinnerSlots((current) =>
              current.map((slot) =>
                slot.rank === rank ? { ...slot, prize_amount: amount } : slot,
              ),
            )
          }
        />
        <SettingsSection
          submissionMode={submissionMode}
          deadline={deadline}
          onSubmissionModeChange={setSubmissionMode}
          onDeadlineChange={setDeadline}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 7: CSS module**

```css
/* components/employer/bounty-editor/BountyEditor.module.css */
.headerActions {
  display: flex;
  gap: 0.65rem;
}

.layout {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sectionHint {
  margin-bottom: 1rem;
  color: var(--ink-55);
  font-size: 0.82rem;
}

.tagEditor {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tagInput {
  display: flex;
  gap: 0.5rem;
}

.tagInput input {
  flex: 1;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.tags button {
  margin-left: 0.4rem;
  border: 0;
  background: none;
  color: inherit;
}

.requirementList {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.requirementRow {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(160px, 1.4fr) 110px 100px 80px;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--ink-06);
}

.prizeRow {
  display: grid;
  grid-template-columns: 90px 1fr 80px;
  gap: 0.6rem;
  align-items: center;
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--ink-06);
}

.requiredToggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  color: var(--ink-55);
}

.removeRow {
  border: 0;
  background: transparent;
  color: var(--score-weak);
  font-size: 0.7rem;
}

.addRow {
  margin-top: 0.6rem;
  border: 0;
  background: transparent;
  color: var(--iris);
  font-size: 0.78rem;
  font-weight: 650;
}

@media (max-width: 700px) {
  .requirementRow,
  .prizeRow {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 8: Index re-export**

```ts
// components/employer/bounty-editor/index.ts
export { default } from "./BountyEditor";
```

- [ ] **Step 9: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from `components/employer/bounty-editor/*`.

- [ ] **Step 10: Commit**

```bash
git add components/employer/bounty-editor
git commit -m "feat: add employer bounty editor components"
```

---

### Task 6: Employer bounty create/edit/list pages

**Files:**
- Create: `app/employer/bounties/new/page.tsx`
- Create: `app/employer/bounties/[id]/edit/page.tsx`
- Create: `app/employer/bounties/page.tsx`

- [ ] **Step 1: Create page**

```tsx
// app/employer/bounties/new/page.tsx
import BountyEditor from "@/components/employer/bounty-editor";

export default function NewBountyPage() {
  return <BountyEditor mode="create" />;
}
```

- [ ] **Step 2: Edit page**

```tsx
// app/employer/bounties/[id]/edit/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import BountyEditor from "@/components/employer/bounty-editor";
import { Loader } from "@/components/ui/loader";
import { bountyApi, type Bounty } from "@/lib/bountyApi";

export default function EditBountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (data) setBounty(data);
        else setError("Bounty not found");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Bounty not found");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!bounty)
    return (
      <div className="employer-page">
        <Loader label="Loading bounty…" />
      </div>
    );

  return <BountyEditor mode="edit" initialBounty={bounty} />;
}
```

- [ ] **Step 3: List page**

```tsx
// app/employer/bounties/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { useAuth } from "@/components/AuthProvider";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

function statusChipClass(status: Bounty["status"]) {
  if (status === "published") return "chip chip-tier-high";
  if (status === "closed") return "chip chip-tier-caution";
  if (status === "winners_announced") return "chip chip-tier-high";
  return "chip";
}

export default function EmployerBountiesPage() {
  const { user } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    bountyApi
      .listMine(user.id)
      .then((data) => {
        if (!cancelled) setBounties(data);
      })
      .catch((err) => console.error("Failed to load bounties:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent discovery</p>
          <h1>Bounties</h1>
          <p>
            Post paid tasks, discover talent through real work, and reward the
            best submissions.
          </p>
        </div>
        <Link className="btn btn-primary" href="/employer/bounties/new">
          ＋ Create bounty
        </Link>
      </div>
      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading bounties…" />
        ) : (
          <table className="table employer-table jobs-table">
            <thead>
              <tr>
                <th>Bounty</th>
                <th>Status</th>
                <th>Prize pool</th>
                <th>Winners</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bounties.map((bounty) => (
                <tr key={bounty.id}>
                  <td>
                    <strong>{bounty.title}</strong>
                    <small>{bounty.tags.join(", ") || "—"}</small>
                  </td>
                  <td>
                    <span className={statusChipClass(bounty.status)}>
                      {bountyStatusLabel(bounty.status)}
                    </span>
                  </td>
                  <td>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)}</td>
                  <td>{bounty.winner_slots.length}</td>
                  <td>{formatDeadline(bounty.deadline)}</td>
                  <td>
                    <Link
                      className="job-detail-arrow"
                      href={`/employer/bounties/${bounty.id}`}
                      aria-label={`View ${bounty.title} details`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && bounties.length === 0 && (
          <div className="empty-state">
            <h3>No bounties yet</h3>
            <p>Create your first bounty to start discovering talent through real work.</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Manual verification (requires Task 1's migration applied)**

Run: `npm run dev`, sign in as an employer, visit `/employer/bounties`. Expected: empty state renders. Click "Create bounty", fill in a title, add one requirement and one winner slot, click "Save draft". Expected: redirected to `/employer/bounties`, new row appears with "Draft" status.

- [ ] **Step 5: Commit**

```bash
git add app/employer/bounties/new/page.tsx "app/employer/bounties/[id]/edit/page.tsx" app/employer/bounties/page.tsx
git commit -m "feat: add employer bounty create, edit, and list pages"
```

---

### Task 7: Employer bounty manage/detail page

**Files:**
- Create: `app/employer/bounties/[id]/page.tsx`

- [ ] **Step 1: Write the page**

```tsx
// app/employer/bounties/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

export default function EmployerBountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (data) setBounty(data);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function transition(action: "publish" | "close" | "announceWinners") {
    if (!bounty) return;
    setBusy(true);
    try {
      if (action === "announceWinners") {
        await bountyApi.announceWinners(bounty.id);
      }
      const updated =
        action === "publish"
          ? await bountyApi.publish(bounty.id)
          : action === "close"
            ? await bountyApi.close(bounty.id)
            : await bountyApi.getById(bounty.id);
      if (updated) setBounty(updated);
    } catch (err) {
      console.error(`Failed to ${action} bounty:`, err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!bounty) return;
    if (!window.confirm("Delete this draft bounty? This can't be undone.")) return;
    setBusy(true);
    try {
      await bountyApi.deleteDraft(bounty.id);
      router.push("/employer/bounties");
    } catch (err) {
      console.error("Failed to delete bounty:", err);
      setBusy(false);
    }
  }

  if (notFound)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
        </div>
      </div>
    );
  if (!bounty)
    return (
      <div className="employer-page">
        <Loader label="Loading bounty…" />
      </div>
    );

  return (
    <div className="employer-page">
      <Link href="/employer/bounties" className="back-link">
        ← All bounties
      </Link>

      <div className="employer-job-detail-head panel">
        <div>
          <div className="employer-job-detail-meta">
            <span className="chip">{bountyStatusLabel(bounty.status)}</span>
            <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
            <span>{formatDeadline(bounty.deadline)}</span>
          </div>
          <h1>{bounty.title}</h1>
          <p>{bounty.rules_text}</p>
        </div>
        <div className="employer-job-detail-actions">
          {bounty.status === "draft" && (
            <>
              <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}/edit`}>
                Edit
              </Link>
              <button className="btn btn-primary" disabled={busy} onClick={() => transition("publish")}>
                Publish
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={handleDelete}>
                Delete draft
              </button>
            </>
          )}
          {bounty.status === "published" && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => transition("close")}>
              Close bounty
            </button>
          )}
          {bounty.status === "closed" && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => transition("announceWinners")}
            >
              Announce winners
            </button>
          )}
        </div>
      </div>

      <div className="employer-job-facts">
        <article className="panel">
          <span>Winners</span>
          <strong>{bounty.winner_slots.length}</strong>
        </article>
        <article className="panel">
          <span>Submission mode</span>
          <strong>{bounty.submission_mode}</strong>
        </article>
        <article className="panel">
          <span>Tags</span>
          <strong>{bounty.tags.join(", ") || "—"}</strong>
        </article>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

From `/employer/bounties`, open the draft bounty created in Task 6. Expected: title, brief, "Edit", "Publish", and "Delete draft" buttons visible. Click Publish. Expected: status chip flips to "Published", action changes to "Close bounty", and "Delete draft" disappears (only drafts can be deleted). Create a second throwaway draft bounty and click "Delete draft" on it. Expected: after confirming the browser prompt, it's removed from `/employer/bounties`.

- [ ] **Step 3: Commit**

```bash
git add "app/employer/bounties/[id]/page.tsx"
git commit -m "feat: add employer bounty manage page with lifecycle actions"
```

---

### Task 8: Public marketplace

**Files:**
- Create: `components/bounties/BountyCard.tsx`
- Create: `app/bounties/page.tsx`
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append marketplace CSS**

Append to the end of `app/globals.css`:

```css

/* Bounty marketplace */
.bounty-card {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  text-decoration: none;
  color: inherit;
  transition:
    transform 0.15s,
    border-color 0.15s;
}
.bounty-card:hover {
  transform: translateY(-2px);
  border-color: var(--iris);
}
.bounty-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.bounty-card h3 {
  font-size: 1.05rem;
}
.bounty-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  color: var(--ink-55);
  font-size: 0.8rem;
}
.bounty-marketplace-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}
```

- [ ] **Step 2: Bounty card**

```tsx
// components/bounties/BountyCard.tsx
import Link from "next/link";
import {
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

export default function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link href={`/bounties/${bounty.id}`} className="panel bounty-card">
      <div className="bounty-card-tags">
        {bounty.tags.map((tag) => (
          <span className="chip" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <h3>{bounty.title}</h3>
      <div className="bounty-card-meta">
        <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
        <span>{bounty.winner_slots.length} winners</span>
        <span>{formatDeadline(bounty.deadline)}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Marketplace page**

```tsx
// app/bounties/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import BountyCard from "@/components/bounties/BountyCard";
import { Loader } from "@/components/ui/loader";
import { bountyApi, type Bounty } from "@/lib/bountyApi";

export default function BountyMarketplacePage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .listPublished()
      .then((data) => {
        if (!cancelled) setBounties(data);
      })
      .catch((err) => console.error("Failed to load bounties:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tags = useMemo(
    () => Array.from(new Set(bounties.flatMap((bounty) => bounty.tags))).sort(),
    [bounties],
  );
  const visible = tagFilter ? bounties.filter((b) => b.tags.includes(tagFilter)) : bounties;

  return (
    <div className="container">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Bounty marketplace</p>
          <h1>Open bounties</h1>
          <p>Real paid work from real companies. Win cash, or build a public track record.</p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="bounty-card-tags" style={{ marginBottom: "1.25rem" }}>
          <button
            className={`chip ${tagFilter === null ? "chip-tier-high" : ""}`}
            onClick={() => setTagFilter(null)}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`chip ${tagFilter === tag ? "chip-tier-high" : ""}`}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loader label="Loading bounties…" />
      ) : visible.length === 0 ? (
        <div className="empty-state panel">
          <h3>No open bounties right now</h3>
          <p>Check back soon — new bounties are published regularly.</p>
        </div>
      ) : (
        <div className="bounty-marketplace-grid">
          {visible.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Manual verification**

In a private/incognito window (logged out), visit `/bounties`. Expected: the published bounty from Task 7 appears as a card with its tags, prize pool, winner count, and deadline. No login redirect occurs.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/bounties/BountyCard.tsx app/bounties/page.tsx
git commit -m "feat: add public bounty marketplace"
```

---

### Task 9: Bounty detail page + candidate submission form

**Files:**
- Create: `components/bounties/BountySubmissionForm.tsx`
- Create: `app/bounties/[id]/page.tsx`

- [ ] **Step 1: Submission form**

```tsx
// components/bounties/BountySubmissionForm.tsx
"use client";

import { useState } from "react";
import {
  bountyApi,
  isSubmissionComplete,
  type Bounty,
  type BountySubmission,
  type RequirementResponse,
  type TeamMember,
} from "@/lib/bountyApi";

export default function BountySubmissionForm({
  bounty,
  candidateUserId,
  candidateEmail,
  existing,
  onSaved,
}: {
  bounty: Bounty;
  candidateUserId: string;
  candidateEmail: string;
  existing: BountySubmission | null;
  onSaved: (submission: BountySubmission) => void;
}) {
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contact_email ?? candidateEmail);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(existing?.team_members ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [responses, setResponses] = useState<Record<string, RequirementResponse>>(
    existing?.responses ?? {},
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadlinePassed = Boolean(
    bounty.deadline && new Date(bounty.deadline).getTime() < Date.now(),
  );
  const showTeamMembers = bounty.submission_mode !== "individual";
  const teamRequired = bounty.submission_mode === "team";

  async function handleFile(itemId: string, file: File) {
    setUploadingId(itemId);
    try {
      const path = await bountyApi.uploadSubmissionFile(bounty.id, candidateUserId, itemId, file);
      setResponses((current) => ({ ...current, [itemId]: { type: "file", value: path } }));
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingId(null);
    }
  }

  function addTeamMember() {
    setTeamMembers((current) => [...current, { name: "", email: "" }]);
  }

  const complete = isSubmissionComplete(bounty.requirement_items, responses);
  const canSave =
    complete &&
    contactName.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    (!teamRequired || teamMembers.length > 0) &&
    !deadlinePassed;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const submission = await bountyApi.upsertSubmission(bounty.id, candidateUserId, {
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        team_members: showTeamMembers ? teamMembers.filter((m) => m.name.trim()) : [],
        responses,
        notes,
      });
      onSaved(submission);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save submission:", err);
      setError(err instanceof Error ? err.message : "Failed to save submission");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel employer-section">
      <h2>{existing ? "Your submission" : "Submit an entry"}</h2>
      {deadlinePassed && (
        <p className="notice notice-warn">The deadline has passed — submissions are closed.</p>
      )}
      {error && <p className="notice notice-error">{error}</p>}

      <div className="form-grid">
        <div className="field">
          <label>Your name</label>
          <input
            className="input"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Contact email</label>
          <input
            className="input"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
      </div>

      {showTeamMembers && (
        <div className="field">
          <label>Team members {teamRequired ? "(required)" : "(optional)"}</label>
          {teamMembers.map((member, index) => (
            <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                className="input"
                placeholder="Name"
                value={member.name}
                onChange={(event) =>
                  setTeamMembers((current) =>
                    current.map((m, i) => (i === index ? { ...m, name: event.target.value } : m)),
                  )
                }
              />
              <input
                className="input"
                placeholder="Email"
                value={member.email}
                onChange={(event) =>
                  setTeamMembers((current) =>
                    current.map((m, i) => (i === index ? { ...m, email: event.target.value } : m)),
                  )
                }
              />
              <button
                className="btn btn-ghost"
                onClick={() => setTeamMembers((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={addTeamMember}>
            + Add teammate
          </button>
        </div>
      )}

      {bounty.requirement_items.map((item) => {
        const response = responses[item.id];
        return (
          <div className="field" key={item.id}>
            <label>
              {item.label} {item.required ? "(required)" : "(optional)"}
            </label>
            {item.description && <small>{item.description}</small>}
            {item.type === "file" ? (
              <div className="dropzone">
                <input
                  type="file"
                  onChange={(event) =>
                    event.target.files?.[0] && handleFile(item.id, event.target.files[0])
                  }
                />
                {uploadingId === item.id
                  ? "Uploading…"
                  : response?.type === "file"
                    ? "File uploaded ✓"
                    : "Choose a file"}
              </div>
            ) : item.type === "link" ? (
              <input
                className="input"
                placeholder="https://…"
                value={response?.value ?? ""}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [item.id]: { type: "link", value: event.target.value },
                  }))
                }
              />
            ) : (
              <textarea
                className="input"
                value={response?.value ?? ""}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [item.id]: { type: "text", value: event.target.value },
                  }))
                }
              />
            )}
          </div>
        );
      })}

      <div className="field">
        <label>Notes (optional)</label>
        <textarea className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <button className="btn btn-primary" disabled={!canSave || saving} onClick={save}>
        {saved ? "Saved ✓" : saving ? "Saving…" : existing ? "Update submission" : "Submit entry"}
      </button>
    </section>
  );
}
```

- [ ] **Step 2: Detail page**

```tsx
// app/bounties/[id]/page.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import BountySubmissionForm from "@/components/bounties/BountySubmissionForm";
import { Loader } from "@/components/ui/loader";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
  type BountySubmission,
} from "@/lib/bountyApi";

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, role, loading: authLoading } = useAuth();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [mySubmission, setMySubmission] = useState<BountySubmission | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setBounty(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!bounty || !user || role !== "candidate") return;
    let cancelled = false;
    bountyApi
      .getMySubmission(bounty.id, user.id)
      .then((data) => {
        if (!cancelled) setMySubmission(data);
      })
      .catch((err) => console.error("Failed to load submission:", err));
    return () => {
      cancelled = true;
    };
  }, [bounty, user, role]);

  if (notFound)
    return (
      <div className="container">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
        </div>
      </div>
    );
  if (loading || !bounty)
    return (
      <div className="container">
        <Loader label="Loading bounty…" />
      </div>
    );

  const isOwner = user?.id === bounty.employer_id;
  const canSubmit = role === "candidate" && bounty.status === "published";

  return (
    <div className="container">
      <Link href="/bounties" className="back-link">
        ← All bounties
      </Link>

      <div className="panel">
        <div className="employer-job-detail-meta">
          <span className="chip">{bountyStatusLabel(bounty.status)}</span>
          <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
          <span>{formatDeadline(bounty.deadline)}</span>
        </div>
        <h1>{bounty.title}</h1>
        <div className="bounty-card-tags">
          {bounty.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        <p style={{ whiteSpace: "pre-wrap" }}>{bounty.rules_text}</p>

        <h3>Prizes</h3>
        <ul>
          {bounty.winner_slots.map((slot) => (
            <li key={slot.rank}>
              Rank {slot.rank}: {formatPrize(slot.prize_amount, bounty.currency)}
            </li>
          ))}
        </ul>

        <h3>What to submit</h3>
        <ul>
          {bounty.requirement_items.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong> ({item.type}
              {item.required ? ", required" : ", optional"})
              {item.description && ` — ${item.description}`}
            </li>
          ))}
        </ul>

        {isOwner && (
          <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}`}>
            Manage this bounty →
          </Link>
        )}
      </div>

      {!authLoading && !user && (
        <div className="notice notice-info">
          <Link href={`/login?redirect=${encodeURIComponent(`/bounties/${id}`)}`}>
            Sign in as a candidate
          </Link>{" "}
          to submit an entry.
        </div>
      )}

      {canSubmit && user && (
        <BountySubmissionForm
          bounty={bounty}
          candidateUserId={user.id}
          candidateEmail={user.email ?? ""}
          existing={mySubmission}
          onSaved={setMySubmission}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification**

Logged out, click into the bounty card from Task 8. Expected: brief, prizes, requirements render; a "Sign in as a candidate to submit an entry" notice shows instead of a form. Log in as a candidate and revisit the same URL. Expected: the submission form renders with one field per requirement item. Upload a file for a "file" requirement, fill required fields, submit. Expected: button reads "Saved ✓", then reverts; reloading the page shows "Your submission" with the saved values pre-filled.

- [ ] **Step 4: Commit**

```bash
git add components/bounties/BountySubmissionForm.tsx "app/bounties/[id]/page.tsx"
git commit -m "feat: add public bounty detail page and candidate submission form"
```

---

### Task 10: Generalize CandidateEmailComposer

> **Superseded during implementation.** A `git pull origin main` landed automatically between the spec and this task (visible in `git reflog`, not run intentionally), bringing in teammate work that turned `CandidateEmailComposer` into real backend-integrated infrastructure: a shared template library, real placeholder population, and real sending via `employerApi.sendComms` through the FastAPI backend, now used by both the candidate profile and a new `OfferConsole.tsx`. `role`/`score` became required, job-context-shaped props. Modifying it as planned below would either delete that real functionality or route bounty outreach through a backend call that assumes a job/application context bounties don't have — both unacceptable. **What was actually built instead:** a new standalone `components/employer/BountyContactButton.tsx` — a self-contained mailto-based composer (pre-filled subject/body, editable, opens the employer's own email client) that never touches `CandidateEmailComposer.tsx` or the backend. Task 11 imports `BountyContactButton`, not `CandidateEmailComposer`. The plan text below is kept for the record but was not executed as written.

**Files:**
- Modify: `components/employer/CandidateEmailComposer.tsx`

Task 11 (next) will call this component with a new `bountyContext`/`triggerLabel` shape; this task adds that support first so Task 11 doesn't depend on a component that doesn't exist yet. The existing call site in `app/employer/candidates/[id]/page.tsx` (`candidateName`, `role`, `score`) is unchanged and must keep working exactly as before.

- [ ] **Step 1: Update the component**

Replace the full contents of `components/employer/CandidateEmailComposer.tsx`:

```tsx
"use client";

import { useState } from "react";

type CandidateEmailComposerProps = {
  candidateName: string;
  role?: string;
  score?: number;
  bountyContext?: {
    bountyTitle: string;
    prizeAmount: number;
    currency: string;
  };
  triggerLabel?: string;
};

export default function CandidateEmailComposer({
  candidateName,
  role,
  score,
  bountyContext,
  triggerLabel = "Email candidate",
}: CandidateEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  function generateWithAura() {
    const firstName = candidateName.split(" ")[0];
    if (bountyContext) {
      setSubject(`You won ${bountyContext.bountyTitle} 🎉`);
      setBody(
        `Hi ${firstName},\n\nCongratulations — your submission to "${bountyContext.bountyTitle}" was selected as a winner. A prize of ${bountyContext.currency} ${bountyContext.prizeAmount.toLocaleString()} has been recorded for you.\n\nBeyond the prize, we were genuinely impressed by the quality of your work and would love to talk about opportunities to work together more directly. Are you open to a quick call?\n\nBest,\nThe hiring team`,
      );
      return;
    }
    setSubject(`Staying connected with Northstar Labs`);
    setBody(
      `Hi ${firstName},\n\nThank you again for the time and thought you brought to our ${role} process. Your evaluation stood out, particularly the strength and consistency of your evidence (${score}/100).\n\nAlthough we are not moving forward with this role, we would value staying connected and considering you for future opportunities that better match your experience and direction. With your permission, we would like to keep your profile in our talent pool and reach out when a suitable role opens.\n\nBest,\nNorthstar Labs Talent Team`,
    );
  }

  function sendEmail() {
    setSent(true);
    window.setTimeout(() => {
      setOpen(false);
      setSent(false);
    }, 900);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        {triggerLabel}
      </button>
      {open && (
        <div className="candidate-email-backdrop" onClick={() => setOpen(false)}>
          <section
            className="candidate-email-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-email-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Candidate communication</p>
                <h2 id="candidate-email-title">Email {candidateName}</h2>
              </div>
              <button
                className="candidate-email-close"
                onClick={() => setOpen(false)}
                aria-label="Close email composer"
              >
                ×
              </button>
            </header>

            <div className="candidate-email-fields">
              <label>
                <span>Tell Aura what this email should accomplish</span>
                <textarea
                  className="input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Example: Thank Daniel for interviewing, explain that we chose another finalist, and invite him to join our talent pool."
                />
              </label>
              <button className="btn btn-ghost aura-generate-email" onClick={generateWithAura}>
                ✦ Generate with Aura
              </button>
              <label>
                <span>Subject</span>
                <input
                  className="input"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Email subject"
                />
              </label>
              <label>
                <span>Email</span>
                <textarea
                  className="input candidate-email-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write an email or generate a draft with Aura."
                />
              </label>
            </div>

            <footer>
              <small>Prototype mode: sending is simulated and no email leaves Aura.</small>
              <div>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!subject.trim() || !body.trim()}
                  onClick={sendEmail}
                >
                  {sent ? "Sent ✓" : "Send email"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Manual verification**

Revisit `/employer/candidates/[id]` for any existing candidate. Expected: "Email candidate" button and generated copy behave exactly as before (job-rejection/talent-pool language, no bounty references) — this confirms the change is backward compatible. The `bountyContext` path has no caller yet; it gets exercised end-to-end in Task 11's verification.

- [ ] **Step 3: Commit**

```bash
git add components/employer/CandidateEmailComposer.tsx
git commit -m "feat: generalize CandidateEmailComposer for bounty winner outreach"
```

---

### Task 11: Employer submissions review panel

**Files:**
- Create: `components/employer/BountySubmissionsPanel.tsx`
- Modify: `app/employer/bounties/[id]/page.tsx`
- Modify: `app/globals.css` (append)

- [ ] **Step 1: Append review-panel CSS**

Append to the end of `app/globals.css`:

```css

/* Bounty submission review */
.bounty-submission-detail {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 0;
}
.bounty-submission-detail ul {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  list-style: none;
  padding: 0;
}
.bounty-submission-actions {
  display: flex;
  gap: 0.6rem;
}
```

- [ ] **Step 2: Review panel**

```tsx
// components/employer/BountySubmissionsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import {
  bountyApi,
  formatPrize,
  nextOpenRank,
  type Bounty,
  type SubmissionResult,
  type SubmissionWithResult,
} from "@/lib/bountyApi";
import BountyContactButton from "@/components/employer/BountyContactButton";

function SubmissionRow({
  bounty,
  submission,
  open,
  openRank,
  fileUrls,
  busy,
  onToggle,
  onMarkWinner,
  onRemoveWinner,
}: {
  bounty: Bounty;
  submission: SubmissionWithResult;
  open: boolean;
  openRank: number | null;
  fileUrls: Record<string, string>;
  busy: boolean;
  onToggle: () => void;
  onMarkWinner: () => void;
  onRemoveWinner: () => void;
}) {
  const result: SubmissionResult | null = submission.result;
  const isWinner = result?.status === "winner";

  return (
    <>
      <tr>
        <td>
          <strong>{submission.contact_name}</strong>
          <small>{submission.contact_email}</small>
        </td>
        <td>{new Date(submission.submitted_at).toLocaleDateString()}</td>
        <td>
          <span className={`chip ${isWinner ? "chip-tier-high" : ""}`}>
            {isWinner
              ? `Winner · Rank ${result!.rank}`
              : result?.status === "not_selected"
                ? "Not selected"
                : "Pending review"}
          </span>
        </td>
        <td>
          <button className="table-action" onClick={onToggle}>
            {open ? "Hide" : "Review"} →
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4}>
            <div className="bounty-submission-detail">
              {submission.notes && <p>{submission.notes}</p>}
              {submission.team_members.length > 0 && (
                <p>
                  Team:{" "}
                  {submission.team_members
                    .map((member) => `${member.name} (${member.email})`)
                    .join(", ")}
                </p>
              )}
              <ul>
                {bounty.requirement_items.map((item) => {
                  const response = submission.responses[item.id];
                  return (
                    <li key={item.id}>
                      <strong>{item.label}: </strong>
                      {!response ? (
                        "—"
                      ) : response.type === "file" ? (
                        fileUrls[response.value] ? (
                          <a href={fileUrls[response.value]} target="_blank" rel="noreferrer">
                            Download
                          </a>
                        ) : (
                          "Loading file…"
                        )
                      ) : response.type === "link" ? (
                        <a href={response.value} target="_blank" rel="noreferrer">
                          {response.value}
                        </a>
                      ) : (
                        response.value
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="bounty-submission-actions">
                {!isWinner ? (
                  <button
                    className="btn btn-primary"
                    disabled={busy || openRank == null}
                    onClick={onMarkWinner}
                  >
                    {openRank == null
                      ? "All ranks assigned"
                      : `Mark as rank ${openRank} winner (${formatPrize(
                          bounty.winner_slots.find((slot) => slot.rank === openRank)?.prize_amount ??
                            0,
                          bounty.currency,
                        )})`}
                  </button>
                ) : (
                  <>
                    <button className="btn btn-ghost" disabled={busy} onClick={onRemoveWinner}>
                      Remove winner
                    </button>
                    <BountyContactButton
                      candidateName={submission.contact_name}
                      contactEmail={submission.contact_email}
                      bountyTitle={bounty.title}
                      prizeAmount={result!.prize_amount ?? 0}
                      currency={bounty.currency}
                    />
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BountySubmissionsPanel({ bounty }: { bounty: Bounty }) {
  const [submissions, setSubmissions] = useState<SubmissionWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    bountyApi
      .listSubmissionsForBounty(bounty.id)
      .then(setSubmissions)
      .catch((err) => console.error("Failed to load submissions:", err))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [bounty.id]);

  async function toggleSubmission(submission: SubmissionWithResult) {
    const opening = openId !== submission.id;
    setOpenId(opening ? submission.id : null);
    if (!opening) return;
    for (const response of Object.values(submission.responses)) {
      if (response.type === "file" && !fileUrls[response.value]) {
        try {
          const url = await bountyApi.getSignedFileUrl(response.value);
          setFileUrls((current) => ({ ...current, [response.value]: url }));
        } catch (err) {
          console.error("Failed to sign file url:", err);
        }
      }
    }
  }

  async function markWinner(submission: SubmissionWithResult, rank: number) {
    const slot = bounty.winner_slots.find((s) => s.rank === rank);
    if (!slot) return;
    setBusyId(submission.id);
    try {
      await bountyApi.markWinner(submission.id, rank, slot.prize_amount);
      reload();
    } catch (err) {
      console.error("Failed to mark winner:", err);
    } finally {
      setBusyId(null);
    }
  }

  async function removeWinner(submission: SubmissionWithResult) {
    setBusyId(submission.id);
    try {
      await bountyApi.removeWinner(submission.id);
      reload();
    } catch (err) {
      console.error("Failed to remove winner:", err);
    } finally {
      setBusyId(null);
    }
  }

  const takenResults = submissions
    .map((s) => s.result)
    .filter((r): r is SubmissionResult => r != null);
  const openRank = nextOpenRank(bounty.winner_slots, takenResults);

  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Submissions</h2>
          <p>{submissions.length} received</p>
        </div>
      </div>

      {loading ? (
        <p>Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <h3>No submissions yet</h3>
        </div>
      ) : (
        <div className="candidate-table-wrap">
          <table className="table employer-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  bounty={bounty}
                  submission={submission}
                  open={openId === submission.id}
                  openRank={openRank}
                  fileUrls={fileUrls}
                  busy={busyId === submission.id}
                  onToggle={() => toggleSubmission(submission)}
                  onMarkWinner={() => openRank != null && markWinner(submission, openRank)}
                  onRemoveWinner={() => removeWinner(submission)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Wire into the manage page**

In `app/employer/bounties/[id]/page.tsx`, add the import:

```tsx
import BountySubmissionsPanel from "@/components/employer/BountySubmissionsPanel";
```

and render it after the `employer-job-facts` grid, replacing the closing of the component's return statement:

```tsx
      <div className="employer-job-facts">
        <article className="panel">
          <span>Winners</span>
          <strong>{bounty.winner_slots.length}</strong>
        </article>
        <article className="panel">
          <span>Submission mode</span>
          <strong>{bounty.submission_mode}</strong>
        </article>
        <article className="panel">
          <span>Tags</span>
          <strong>{bounty.tags.join(", ") || "—"}</strong>
        </article>
      </div>

      {bounty.status !== "draft" && <BountySubmissionsPanel bounty={bounty} />}
    </div>
  );
}
```

(This replaces the previous `</div>\n  );\n}` ending of the file with the same closing plus the new panel line above it.)

- [ ] **Step 4: Manual verification**

As the employer who owns the published bounty from Task 9, visit `/employer/bounties/[id]`. Expected: a "Submissions" section lists the candidate's entry. Click "Review". Expected: requirement responses render, the uploaded file shows a working "Download" link, and a "Mark as rank 1 winner ($…)" button appears. Click it. Expected: status chip flips to "Winner · Rank 1", and a "Contact candidate" button appears in place of the mark-winner button. Click "Contact candidate". Expected: a modal opens with the winner's contact email pre-filled as "To", and subject/body referencing the bounty title and prize amount.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/employer/BountySubmissionsPanel.tsx "app/employer/bounties/[id]/page.tsx"
git commit -m "feat: add employer bounty submissions review and winner selection"
```

---

### Task 12: Candidate bounty history on talent-pool profile

**Files:**
- Create: `components/employer/BountyCandidateHistory.tsx`
- Modify: `app/employer/candidates/[id]/page.tsx`

- [ ] **Step 1: History component**

```tsx
// components/employer/BountyCandidateHistory.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bountyApi, formatPrize, type CandidateBountyHistory } from "@/lib/bountyApi";

export default function BountyCandidateHistory({
  candidateUserId,
}: {
  candidateUserId: string;
}) {
  const [history, setHistory] = useState<CandidateBountyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .listCandidateHistory(candidateUserId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => console.error("Failed to load bounty history:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [candidateUserId]);

  if (loading || history.length === 0) return null;

  return (
    <section className="panel employer-section profile-note">
      <h3>Bounty submissions</h3>
      {history.map(({ submission, bounty, result }) => (
        <p key={submission.id}>
          <Link href={`/bounties/${bounty.id}`}>{bounty.title}</Link>
          {result?.status === "winner"
            ? ` · Won (${formatPrize(result.prize_amount ?? 0, bounty.currency)})`
            : result?.status === "not_selected"
              ? " · Not selected"
              : " · Submitted"}
        </p>
      ))}
    </section>
  );
}
```

- [ ] **Step 2: Wire into the candidate detail page**

In `app/employer/candidates/[id]/page.tsx`, add the import alongside the existing ones:

```tsx
import BountyCandidateHistory from "@/components/employer/BountyCandidateHistory";
```

Then insert the component into the `<aside>` block, immediately after the "Other roles" section closes and before the red-flag-card section. Find this existing block:

```tsx
          {detail.rows.length > 1 && (
            <section className="panel employer-section profile-note">
              <h3>Other roles</h3>
              {detail.rows
                .filter((r) => r !== row)
                .map((r) => (
                  <p key={r.job_id}>
                    {r.job_title}
                    {r.evaluation?.wlc_score != null &&
                      ` · ${Math.round(r.evaluation.wlc_score)} match`}
                  </p>
                ))}
            </section>
          )}
```

and add the new component directly after it:

```tsx
          {detail.rows.length > 1 && (
            <section className="panel employer-section profile-note">
              <h3>Other roles</h3>
              {detail.rows
                .filter((r) => r !== row)
                .map((r) => (
                  <p key={r.job_id}>
                    {r.job_title}
                    {r.evaluation?.wlc_score != null &&
                      ` · ${Math.round(r.evaluation.wlc_score)} match`}
                  </p>
                ))}
            </section>
          )}
          <BountyCandidateHistory candidateUserId={detail.candidate_user_id} />
```

- [ ] **Step 3: Manual verification**

Visit `/employer/candidates/[id]` for the candidate who submitted to the bounty in Task 9 (they must already appear in this employer's talent pool via a job application/evaluation for this route to resolve — that's an existing constraint of this page, unrelated to bounties). Expected: a "Bounty submissions" panel appears in the sidebar listing the bounty title, linking to its public page, with a "Won ($…)" or "Submitted" suffix matching its actual result status.

- [ ] **Step 4: Commit**

```bash
git add components/employer/BountyCandidateHistory.tsx "app/employer/candidates/[id]/page.tsx"
git commit -m "feat: show bounty submission history on candidate talent-pool profile"
```

---

### Task 13: End-to-end verification

**Files:** none — this task only runs the app and checks behavior end to end (matches spec §7).

- [ ] **Step 1: Full walkthrough**

Run: `npm run dev`. With Task 1's migration already applied:

1. As an employer, create and publish a bounty with a "team" or "both" submission mode, one file requirement, one link requirement, and two winner ranks.
2. Logged out, confirm the bounty appears on `/bounties` and its detail page renders with no login redirect.
3. As a candidate, submit an entry (upload a file, fill the link, add a teammate if the mode requires it).
4. As the employer, open the bounty's submissions list, review the entry (confirm the file downloads via the signed URL), mark it rank 1 winner, confirm "Contact candidate" opens with bounty-specific copy.
5. As the employer, click "Announce winners"; confirm bounty status becomes "Winners announced".
6. As the employer, visit the candidate's talent-pool profile (if they're already in this employer's talent pool via a job application) and confirm the bounty shows under "Bounty submissions" with the correct win status.
7. As a second candidate, confirm they cannot see the first candidate's submitted files (only their own), but as any employer, confirm the first candidate's submission still appears in that candidate's history metadata (not the files).

Expected: every step above succeeds with no console errors (`read_console_messages`/browser devtools) and no unexpected network 4xx/5xx (`read_network_requests`).

- [ ] **Step 2: Run the unit tests one more time**

Run: `node --experimental-strip-types --test lib/bountyHelpers.test.mjs`
Expected: PASS.

- [ ] **Step 3: Type-check the whole app**

Run: `npx tsc --noEmit`
Expected: no errors in any file this plan touched.

- [ ] **Step 4: Report to the user**

Summarize what was verified and any deviations encountered (e.g., if the `users` table doesn't actually have a `role` column with the exact values assumed in Task 1's RLS, or if bounty file uploads behave unexpectedly) so the user can decide whether to adjust the migration.
