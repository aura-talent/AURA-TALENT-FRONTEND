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
