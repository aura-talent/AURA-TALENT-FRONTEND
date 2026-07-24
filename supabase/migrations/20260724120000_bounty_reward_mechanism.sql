-- Bounty Reward Mechanism
-- Run this against the Supabase project this app points to
-- (NEXT_PUBLIC_SUPABASE_URL in .env.local) via the SQL editor or `supabase db push`.
-- Assumes a `public.users` table already exists with `id text primary key`
-- (confirmed live: users.id is TEXT, not uuid, despite storing Supabase Auth
-- UUIDs as strings) and a `role` text column ('employer' | 'candidate') —
-- used by components/AuthProvider.tsx today. auth.uid() returns uuid, so
-- every RLS comparison against these columns casts it with ::text.

create table if not exists public.bounties (
  id uuid primary key default gen_random_uuid(),
  employer_id text not null references public.users(id),
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
  candidate_user_id text not null references public.users(id),
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
    or employer_id = auth.uid()::text
  );

create policy "bounties_insert_own_employer" on public.bounties
  for insert
  to authenticated
  with check (
    employer_id = auth.uid()::text
    and exists (select 1 from public.users u where u.id = auth.uid()::text and u.role = 'employer')
  );

create policy "bounties_update_own" on public.bounties
  for update
  to authenticated
  using (employer_id = auth.uid()::text)
  with check (employer_id = auth.uid()::text);

create policy "bounties_delete_own" on public.bounties
  for delete
  to authenticated
  using (employer_id = auth.uid()::text);

-- bounty_submissions ------------------------------------------------------

create policy "submissions_select_own_owner_or_employer" on public.bounty_submissions
  for select
  using (
    candidate_user_id = auth.uid()::text
    or exists (
      select 1 from public.bounties b
      where b.id = bounty_submissions.bounty_id and b.employer_id = auth.uid()::text
    )
    or exists (select 1 from public.users u where u.id = auth.uid()::text and u.role = 'employer')
  );

create policy "submissions_insert_own_candidate" on public.bounty_submissions
  for insert
  to authenticated
  with check (
    candidate_user_id = auth.uid()::text
    and exists (select 1 from public.users u where u.id = auth.uid()::text and u.role = 'candidate')
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
  using (candidate_user_id = auth.uid()::text)
  with check (
    candidate_user_id = auth.uid()::text
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
          s.candidate_user_id = auth.uid()::text
          or exists (select 1 from public.bounties b where b.id = s.bounty_id and b.employer_id = auth.uid()::text)
        )
    )
    or exists (select 1 from public.users u where u.id = auth.uid()::text and u.role = 'employer')
  );

create policy "results_insert_bounty_owner" on public.bounty_submission_results
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()::text
    )
  );

create policy "results_update_bounty_owner" on public.bounty_submission_results
  for update
  to authenticated
  using (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()::text
    )
  )
  with check (
    exists (
      select 1 from public.bounty_submissions s
      join public.bounties b on b.id = s.bounty_id
      where s.id = bounty_submission_results.submission_id and b.employer_id = auth.uid()::text
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
          and b.employer_id = auth.uid()::text
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
