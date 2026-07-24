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
