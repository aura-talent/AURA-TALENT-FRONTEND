/**
 * Candidate-facing "explore jobs" mock data.
 *
 * This is the candidate side of the app, which is out of the current
 * employer-backend scope. These pages previously borrowed the employer
 * module's mock `jobs` array; that array has since been removed as the
 * employer side moved to real Supabase data. This local mock keeps the
 * candidate job-browsing pages working unchanged until the candidate side
 * gets its own real jobs feed.
 */

export type CandidateJob = {
  id: string;
  employer_id: string;
  title: string;
  team: string;
  status: "Active" | "Draft";
  location: string;
  employment_type: string;
  salary_low: number;
  salary_high: number;
  salary_currency: string;
  description: string;
  keywords: string[];
  mock_interview_enabled: boolean;
  interview_questions: string[];
  company_name?: string; // Optional if returned from backend, or fallback
  fit_score?: number;    // Optional match score
  recommended?: boolean;
};
