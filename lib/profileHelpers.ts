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
  tour_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProfilePayload = Partial<
  Omit<CandidateProfile, "user_id" | "created_at" | "updated_at">
>;
