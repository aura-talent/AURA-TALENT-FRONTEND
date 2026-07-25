-- Candidate Onboarding Tour
-- Run this against the Supabase project this app points to
-- (NEXT_PUBLIC_SUPABASE_URL in .env.local) via the SQL editor or `supabase db push`.
-- Additive column on the existing candidate_profiles table — its owner-only
-- RLS policies (from 20260725120000_candidate_profiles.sql) already cover it.

alter table public.candidate_profiles
  add column if not exists tour_completed_at timestamptz;
