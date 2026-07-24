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
