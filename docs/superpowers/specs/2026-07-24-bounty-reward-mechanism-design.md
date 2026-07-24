# Bounty Reward Mechanism — Design Spec

**Date:** 2026-07-24
**Status:** Approved pending final user review
**Repos:** AURA-TALENT-FRONTEND only. Deliberately bypasses the FastAPI backend — all persistence, access control, and file storage live in Supabase (tables + RLS + Storage), driven directly from Next.js. This mirrors the existing precedent of `AuthProvider` reading/writing the `users` table straight through `supabase-js` rather than proxying through `/api/backend`.
**Context:** Employers currently discover candidates only through job applications/evaluations. Bounties let an employer post a paid task (marketing content, pre-launch testing, bug fixes, etc.), award cash prizes to up to N winners, and — just as importantly — build a searchable trail of real work product from candidates who didn't win, usable as skill evidence elsewhere in the product.

## 1. What it is

A new "Bounty" object employers create and publish to a public marketplace. Candidates (logged in) submit entries against a structured checklist the employer defines. The employer manually reviews submissions and marks up to N of them as winners with a snapshotted cash amount per rank. Winning a bounty surfaces a "Contact candidate" action that reuses the existing employer outreach modal. Every submission — win or lose — becomes visible to any employer viewing that candidate elsewhere in the product, as proof of skill.

**Explicitly out of scope for v1** (raised and declined during brainstorming, called out here so it isn't silently reintroduced during implementation):
- Real payment processing (Stripe/bank transfer). Prize amounts are recorded; payout happens outside the app.
- Team invite/accept flow. Teams are "lead submits, lists teammates as free text" — no separate team accounts.
- Submission scoring/rubrics. Winner selection is pure manual judgment.
- Any notifications (email/push) on publish, submission received, or winner announced.

## 2. Data model

Three new Supabase tables, no changes to existing ones. Splitting submission **content** (candidate-owned) from **judging outcome** (employer-owned) into separate tables keeps RLS declarative — no column-level security tricks needed, each table has exactly one kind of writer.

```
bounties
  id                uuid PK default gen_random_uuid()
  employer_id       uuid NOT NULL references users(id)
  title             text NOT NULL
  tags              text[] NOT NULL default '{}'          -- free-text, e.g. {"Marketing", "Content"}
  rules_text        text                                   -- freeform brief/instructions (markdown)
  requirement_items jsonb NOT NULL default '[]'
    -- [{ id: string, label: string, description: string, type: "file"|"link"|"text", required: boolean }]
    -- id is a client-generated uuid, assigned once when the employer adds the item in the editor
    -- and never regenerated on subsequent edits — it's the stable key used in submissions.responses
  submission_mode   text NOT NULL default 'individual'
    check (submission_mode in ('individual','team','both'))
  winner_slots      jsonb NOT NULL default '[]'
    -- ordered [{ rank: 1, prize_amount: number }, ...] — length = number of winners
  currency          text NOT NULL default 'USD'
  deadline          timestamptz                            -- nullable: no deadline = manual close only
  status            text NOT NULL default 'draft'
    check (status in ('draft','published','closed','winners_announced'))
  published_at      timestamptz
  closed_at         timestamptz
  winners_announced_at timestamptz
  created_at        timestamptz NOT NULL default now()
  updated_at        timestamptz NOT NULL default now()

bounty_submissions
  id                uuid PK default gen_random_uuid()
  bounty_id         uuid NOT NULL references bounties(id) on delete cascade
  candidate_user_id uuid NOT NULL references users(id)     -- the lead/submitter
  team_members      jsonb NOT NULL default '[]'             -- [{ name: string, email: string }] free text
  responses         jsonb NOT NULL default '{}'
    -- { [requirement_item_id]: { type: "file"|"link"|"text", value: string } }
    -- value = storage path (file) | URL (link) | text (text)
  notes             text
  submitted_at      timestamptz NOT NULL default now()
  updated_at        timestamptz NOT NULL default now()
  unique (bounty_id, candidate_user_id)

bounty_submission_results
  id                uuid PK default gen_random_uuid()
  submission_id     uuid NOT NULL references bounty_submissions(id) on delete cascade unique
  status            text NOT NULL default 'pending'
    check (status in ('pending','winner','not_selected'))
  rank              integer                                 -- set only when status = 'winner'
  prize_amount      numeric                                 -- snapshotted from winner_slots at selection time
  contacted_at      timestamptz
  decided_at        timestamptz
```

**Storage bucket** `bounty-submissions` (private), path convention:
`{bounty_id}/{candidate_user_id}/{requirement_item_id}-{filename}`

## 3. Access control (Postgres RLS — this IS the app's authorization layer)

No Next.js API routes are needed for authorization; every table and the storage bucket enforce access at the Postgres level so the browser can call `supabase-js` directly.

**`bounties`**
- `SELECT`: `status = 'published'` (open to `anon` + `authenticated`) OR `employer_id = auth.uid()` (owner sees all statuses).
- `INSERT`: `authenticated`, `employer_id = auth.uid()`, and caller's `users.role = 'employer'`.
- `UPDATE`/`DELETE`: `employer_id = auth.uid()` only.

**`bounty_submissions`**
- `SELECT`: `candidate_user_id = auth.uid()` OR the caller is the owning bounty's employer OR the caller's `users.role = 'employer'` (this last clause is intentional — it's what lets *any* employer see a candidate's bounty history as skill evidence, not just the bounty owner).
- `INSERT`: `candidate_user_id = auth.uid()`, caller's `users.role = 'candidate'`, and the target bounty is `published` and (`deadline IS NULL OR now() < deadline`).
- `UPDATE`: same candidate-owns-row + still-open condition (supports edit-until-deadline).
- No `DELETE` policy — a submission can't be withdrawn once made, only edited.

**`bounty_submission_results`**
- `SELECT`: same broad policy as `bounty_submissions` (metadata is visible platform-wide; see §5 for why files are not).
- `INSERT`/`UPDATE`: only the employer who owns the parent bounty (`bounties.employer_id = auth.uid()` via join through `bounty_submissions.bounty_id`).

**Storage objects** (`bounty-submissions` bucket)
- `SELECT` (governs both direct download and `createSignedUrl`): the submitting candidate (path's `candidate_user_id` segment matches `auth.uid()`) OR the owning bounty's employer only. This is deliberately narrower than the results-table metadata policy — other employers see *that* a submission happened, not the files themselves.
- `INSERT`/`UPDATE`/`DELETE`: the submitting candidate only, and only while their submission window is open (bounty published, before deadline) — mirrors the `bounty_submissions` write policy.

## 4. Frontend routes & components

### Candidate/public side
- **`/bounties`** — public marketplace, no login required. Filterable by tag, shows title, employer name, total prize pool (sum of `winner_slots`), winner count, deadline, status badge. Only `published` bounties are queryable (RLS handles this even for `anon`).
- **`/bounties/[id]`** — full brief (`rules_text`), requirement checklist, prize breakdown per rank, deadline. Logged-out visitors see the brief plus a "Sign in to submit" CTA. Logged-in candidates see their existing submission (if any, editable until deadline) or a submission form: one input per `requirement_item` (file upload straight to Storage / URL field / text field), general notes. Team member list behavior depends on `submission_mode`: hidden for `individual`, required (at least one teammate) for `team`, optional for `both`.

`RouteGuard` changes: add a `PUBLIC_PREFIXES = ["/bounties"]` array checked with `startsWith`, alongside the existing exact-match `PUBLIC_ROUTES`. `/bounties` is excluded from `isCandidateRoute` so it doesn't force a login redirect, and doesn't get bounced by the employer-role redirect either — employers can browse the marketplace too.

### Employer side (existing `/employer` shell, role-gated)
- **`/employer/bounties`** — list of the employer's own bounties across all statuses, with submission counts and days-to-deadline.
- **`/employer/bounties/new`** (and edit-while-draft) — multi-section form mirroring the existing `JobEditor` pattern: Details (title, tags, rules_text) → Requirements (add/remove/reorder `requirement_items`) → Prizes (winner count + per-rank amount + currency) → Settings (deadline, `submission_mode`). Actions: Save Draft / Publish.
- **`/employer/bounties/[id]`** — management view: edit (while `draft`), lifecycle actions (Publish / Close / Announce Winners), and the submissions list. Each row opens a detail panel with full response content and signed-URL file links (fetched via `createSignedUrl`, gated by the storage RLS above), plus "Mark as winner" (pick an open rank from `winner_slots`) / "Remove winner". Once a submission's result is `winner`, a "Contact candidate" button appears.
- **Announce Winners**: bulk operation — for every submission of the bounty without a `winner` result, upsert `bounty_submission_results.status = 'not_selected'`; set `bounties.status = 'winners_announced'` and `winners_announced_at`. Run as a small sequence of client-side upserts (row count per bounty is small; no need for a Postgres function).
- **Existing `app/employer/candidates/[id]` talent-pool page**: new "Bounty submissions" section. Queries `bounty_submissions` + `bounty_submission_results` for that `candidate_user_id` across *all* bounties (the broad metadata `SELECT` policy makes this work regardless of which employer is looking), rendering bounty title (linked to the public `/bounties/[id]` page), employer name, status badge, submitted date. No file access from here — that's still bounty-owner-only.

### Reused/modified components
- **`CandidateEmailComposer`**: currently hardcodes job-match copy from `role` + `score` props. Generalize it to accept an optional `context` string that replaces the generated subject/body, so the bounty "Contact candidate" action can supply bounty-appropriate copy (bounty title, prize won) without duplicating the modal. Stays a simulated send, matching its current (non-functional) behavior — not a new gap introduced by this feature.
- New `lib/bountyApi.ts`, structured like `lib/employerApi.ts` (typed functions + shared display helpers) but calling `supabase.from(...)` / `supabase.storage` directly instead of the `/api/backend` proxy.

## 5. Nav

- Candidate nav (`components/Nav.tsx` `APP_LINKS`): add `{ href: "/bounties", label: "BOUNTIES" }`.
- Employer nav (`EMPLOYER_LINKS`): add `{ href: "/employer/bounties", label: "BOUNTIES" }`.

## 6. Error handling & edge cases

- **Deadline race**: a candidate submitting/editing right as the deadline passes is blocked by the RLS `deadline` check at the database level (not just client-side), so there's no window where a late write succeeds.
- **Winner slot exhaustion**: the "Mark as winner" UI only offers ranks from `winner_slots` not already assigned to another `winner` result for that bounty; enforced client-side (small N, no concurrent-employer scenario to worry about since only one employer owns a bounty).
- **Bounty deleted with submissions**: `DELETE` is owner-only per RLS, but the UI only exposes deletion while `status = 'draft'` (no submissions can exist yet) to avoid orphaning candidate work — enforced in the UI, not the database, since RLS doesn't need to block it (a published bounty with submissions realistically won't be deleted by its own employer, but nothing stops it at the DB level if they insist via direct API access).
- **Missing required requirement item**: submission form disables the Submit button until every `required: true` item has a non-empty response; not enforced at the DB level (jsonb, no per-key constraint) — acceptable since the only writer is the owning candidate.

## 7. Testing

- No existing test suite covers `app/employer/*` or `lib/employerApi.ts` (no test files found under those paths) — this feature follows the same convention (manual verification via the dev server), consistent with the rest of the employer surface.
- Manual verification plan: create a bounty as an employer, publish it, submit as a candidate (file + link + text requirement types), verify the marketplace and detail page render correctly logged-out, mark a winner, announce winners, confirm the contact composer opens with bounty context, and confirm the candidate's talent-pool profile shows the submission history.
