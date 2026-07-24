/**
 * Client-side API helpers. Everything goes through the /api/backend proxy
 * so the backend API key never reaches the browser.
 */
import { supabase } from "./supabaseClient";

let activeUserId: string | null = null;

export function setUserId(id: string | null) {
  activeUserId = id;
}

export function getUserId(): string {
  if (activeUserId) return activeUserId;
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem("aura_uid");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("aura_uid", id);
  }
  return id;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string | null = null;
  try {
    const sessionRes = await supabase.auth.getSession();
    token = sessionRes.data.session?.access_token ?? null;
  } catch (err) {
    console.error("Failed to get session token:", err);
  }

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  headers.set("Accept", "application/json");

  const resp = await fetch(`/api/backend/${path}`, {
    ...init,
    headers,
  });
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (data.detail)
        detail =
          typeof data.detail === "string"
            ? data.detail
            : JSON.stringify(data.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json();
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/* ── Types mirrored from the FastAPI schemas ── */

export interface Scores {
  match_cv: number;
  alignment: number;
  comp: number;
  culture: number;
  red_flags: number;
  global_score: number;
}

export interface Legitimacy {
  tier: string;
  signals: { signal: string; finding: string; weight: string }[];
  context_notes: string;
}

export interface SalaryBand {
  low: number; // ~P25
  mid: number; // ~P50 / median
  high: number; // ~P75
}

/**
 * Salary intelligence attached to an evaluation. Every figure carries its
 * provenance (sources, as_of, confidence) so the UI can stay honest when
 * data is thin — the same principle as the legitimacy tier. All fields
 * beyond role_worth/currency/confidence are optional; the panel degrades
 * gracefully when the backend can only supply part of the picture.
 */
export interface SalaryEstimate {
  currency: string; // ISO 4217, e.g. "USD", "MYR"
  period: "year" | "month" | "hour";
  role_worth: SalaryBand; // what this role should pay (base)
  candidate_worth?: SalaryBand; // what the user is worth, from their profile
  total_comp_high?: number; // realistic ceiling incl. bonus/equity
  posted?: { low?: number; high?: number }; // range from the JD, if stated
  gap?: {
    verdict: "below" | "fair" | "above"; // posted range vs role_worth
    delta_pct: number; // signed %: posted mid vs role mid
    note: string;
  };
  negotiation?: { anchor: number; line: string };
  confidence: "high" | "medium" | "low";
  sources: string[]; // e.g. ["Adzuna", "BLS OES 15-1252"]
  as_of: string; // ISO date the market data was pulled
  location_basis: string; // e.g. "Remote (US national)", "Kuala Lumpur"
}

export interface SkillDelta {
  skill: string;
  delta_pct: number;
  note: string;
}

/** Candidate's own market worth, profile-driven (the "Your worth" page). */
export interface SelfWorthEstimate {
  currency: string;
  period: "year" | "month" | "hour";
  worth: SalaryBand;
  total_comp_high?: number;
  confidence: "high" | "medium" | "low";
  sources: string[];
  as_of: string;
  location_basis: string;
  headline_role: string;
  summary: string;
  skill_deltas: SkillDelta[];
}

export interface Evaluation {
  evaluation_id: number;
  company: string;
  role: string;
  archetype: string;
  score: number;
  scores: Scores;
  recommendation: string;
  legitimacy: Legitimacy;
  report_markdown: string;
  keywords: string[];
  jd_url?: string;
  salary?: SalaryEstimate;
}

export interface Application {
  id: string;
  evaluation_id: number;
  date: string;
  company: string;
  role: string;
  score: number;
  /** Raw LLM score breakdown: match_cv, alignment, comp, culture, red_flags, global_score (1-5 scale) */
  scores?: {
    match_cv?: number;
    alignment?: number;
    comp?: number;
    culture?: number;
    red_flags?: number;
    global_score?: number;
  } | null;
  user_id?: string;
  status: string;
  interview_type: "virtual" | "physical" | "none";
  mock_interview_done: boolean;
  notes: string;
  attachments: {
    name: string;
    url: string;
    type: "file" | "link";
    category?: string;
  }[];
  priority: "low" | "medium" | "high";
  tags: string[];
  interviews: {
    id: string;
    name: string;
    type: "virtual" | "physical" | "phone";
    date: string;
    interviewer?: string;
    checklist?: { text: string; done: boolean }[];
    feedback?: string;
  }[];
  timeline: {
    date: string;
    title: string;
    description: string;
    custom?: boolean;
  }[];
}

export interface ResumeData {
  user_id: string;
  markdown: string;
  profile: Record<string, unknown>;
}

export interface JobPosting {
  company: string;
  title: string;
  url: string;
  location: string;
  source: string;
}

export type MoveCategory =
  | "Networking"
  | "Side project / business"
  | "Visibility / personal brand"
  | "Internal play"
  | "Skill / credential"
  | "Strategic job move"
  | "Comp / geo arbitrage"
  | "Mentorship";

export interface CareerMove {
  category: MoveCategory | string; // model may return a close variant; treat as string-safe
  action: string;
  why: string;
  effort: "low" | "medium" | "high" | string;
  timeframe: string;
}

export interface CareerRoute {
  title: string;
  archetype: string;
  fit: number; // 1–5, how realistic from the current position
  time_horizon: string;
  rationale: string;
  skill_gaps: string[];
  moves: CareerMove[];
}

export interface CareerPathOut {
  user_id: string;
  current_assessment: string;
  first_move: string;
  routes: CareerRoute[];
  recommended_route: string;
  evaluations_considered: number;
  report_markdown: string;
}

export interface CareerPathIn {
  user_id: string;
  goal?: string;
  horizon?: string;
}

/* ── Employability statistics (curated dataset, no LLM) ── */

export interface EmployabilitySalaryBand {
  p25: number;
  /** Median — null where the published guide gives only a range. */
  p50: number | null;
  p75: number;
  currency: string;
  period: string;
  source_ids?: string[];
  basis?: string;
}

export interface EmployabilityDegree {
  field: string;
  employment_rate_pct: number | null;
  salary: EmployabilitySalaryBand;
  source_ids: string[];
}

export interface EmployabilityUniversity {
  id: string;
  name: string;
  country: "MY" | "SG";
  employment_rate_pct: number | null;
  rate_basis: string;
  source_ids: string[];
  degrees: EmployabilityDegree[];
  survey_year: number | null;
  respondents: number | null;
}

/** Role salary: a tight current-market range plus junior/senior career anchors. */
export interface EmployabilityRoleBand {
  typical: { lo: number; hi: number };
  junior: number | null;
  senior: number | null;
  currency: string;
  period: string;
  source_ids?: string[];
  basis?: string;
  typical_basis?: string;
  anchor_basis?: string;
}

export interface EmployabilityRole {
  id: string;
  title: string;
  salary: Partial<Record<"MY" | "SG", EmployabilityRoleBand>>;
  demand_note?: string;
}

export interface EmployabilityBenchmark {
  employment_rate_pct: number;
  label: string;
  source_ids: string[];
}

export interface EmployabilityDataset {
  updated: string;
  sources: { id: string; label: string; url: string }[];
  universities: EmployabilityUniversity[];
  roles: EmployabilityRole[];
  benchmarks?: Partial<Record<"MY" | "SG", EmployabilityBenchmark>>;
}

/* ── Career map ── */

export type CareerMapNodeKind =
  | "current"
  | "progression"
  | "pivot"
  | "wildcard";

export interface CareerMapNode {
  id: string;
  title: string;
  kind: CareerMapNodeKind;
  duration: string;
  fit: number;
  salary_hint: string;
  why: string;
  skill_gaps: string[];
  moves: CareerMove[];
  expandable: boolean;
}

export interface CareerMapEdge {
  source: string;
  target: string;
  kind: Exclude<CareerMapNodeKind, "current">;
}

export interface CareerMapOut {
  user_id: string;
  current_assessment: string;
  nodes: CareerMapNode[];
  edges: CareerMapEdge[];
  recommended_node_id: string;
  generated_at: string;
}

/* ── Endpoints ── */

export const api = {
  getResume: () => request<ResumeData>(`resume/${getUserId()}`),

  employabilityDataset: () =>
    request<EmployabilityDataset>("stats/employability/dataset"),

  uploadResume: (file: File) => {
    const form = new FormData();
    form.append("user_id", getUserId());
    form.append("file", file);
    return request<ResumeData>("resume/upload", { method: "POST", body: form });
  },

  submitResumeText: (text: string) =>
    postJson<ResumeData>("resume/text", { user_id: getUserId(), text }),

  evaluate: (input: { jd_text?: string; jd_url?: string }) =>
    postJson<Evaluation>("jobs/evaluate", { user_id: getUserId(), ...input }),

  compare: (evaluation_ids: number[]) =>
    postJson<{ comparison_markdown: string }>("jobs/compare", {
      user_id: getUserId(),
      evaluation_ids,
    }),

  careerMap: (force_refresh = false) =>
    postJson<CareerMapOut>("career/map", {
      user_id: getUserId(),
      force_refresh,
    }),

  careerMapExpand: (node_id: string) =>
    postJson<CareerMapOut>("career/map/expand", {
      user_id: getUserId(),
      node_id,
    }),

  selfWorth: (input: { location?: string; currency?: string } = {}) =>
    postJson<SelfWorthEstimate>("salary/self", {
      user_id: getUserId(),
      ...input,
    }),

  suggestions: (input: { jd_text?: string; jd_url?: string }) =>
    postJson<{ suggestions_markdown: string }>("resume/suggestions", {
      user_id: getUserId(),
      ...input,
    }),

  scan: (
    input: {
      companies?: string[];
      title_keywords?: string[];
      location_keywords?: string[];
    } = {},
  ) =>
    postJson<{ total: number; jobs: JobPosting[]; errors: string[] }>(
      "scan",
      input,
    ),

  listApplications: () => request<Application[]>(`applications/${getUserId()}`),

  getReport: (id: number) =>
    request<{ evaluation_id: number; report_markdown: string }>(
      `applications/${getUserId()}/${id}/report`,
    ),

  updateStatus: (id: string | number, status: string, notes?: string) =>
    request<{ ok: boolean }>(`applications/${getUserId()}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    }),

  createManualApplication: (
    company: string,
    role: string,
    status = "Applied",
  ) =>
    postJson<Application>(`applications/${getUserId()}`, {
      company,
      role,
      status,
    }),

  updateApplicationDetails: (
    applicationId: string,
    updatePayload: {
      status: string;
      interview_type: string;
      mock_interview_done: boolean;
      notes: string;
      attachments: Application["attachments"];
      priority: string;
      tags: string[];
      interviews: Application["interviews"];
      timeline: Application["timeline"];
    },
  ) =>
    request<{ ok: boolean }>(
      `applications/${getUserId()}/${applicationId}/details`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      },
    ),

  deleteApplication: (applicationId: string) =>
    request<{ ok: boolean }>(`applications/${getUserId()}/${applicationId}`, {
      method: "DELETE",
    }),

  saveUser: (input: {
    id: string;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
    role?: string | null;
  }) => postJson<{ ok: boolean }>("users", input),

  getUserProfile: (userId: string) =>
    request<{
      id: string;
      email: string | null;
      full_name: string | null;
      avatar_url: string | null;
      role: string;
    }>(`users/${userId}`),

  migrateUser: (input: { anon_id: string; auth_id: string }) =>
    postJson<{ ok: boolean }>("users/migrate", input),

  getPipelineUpdates: () =>
    request<PipelineStageUpdate[]>(`applications/${getUserId()}/pipeline`),

  getAllApplications: () => request<Application[]>("applications/all"),

  /** Employer posts a pipeline stage update for a real candidate. */
  postPipelineUpdate: (candidateUserId: string, payload: PipelineUpdateIn) =>
    postJson<PipelineStageUpdate>(
      `applications/${candidateUserId || "employer-demo"}/pipeline`,
      payload,
    ),

  /**
   * Update a candidate's tracker status from the employer side.
   * Uses the candidate's user_id (not the logged-in employer) so the
   * backend's per-user row lookup succeeds.
   */
  updateCandidateTrackerStatus: (
    candidateUserId: string,
    applicationId: string,
    status: string,
    notes?: string,
  ) =>
    request<{ ok: boolean }>(
      `applications/${candidateUserId}/${applicationId}/status`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes }),
      },
    ),

  listTemplates: (role?: string) =>
    request<any[]>(role ? `templates?role=${encodeURIComponent(role)}` : "templates"),

  generateTemplate: (input: {
    prompt: string;
    template_id?: string;
    role: string;
    tone?: string;
    length?: string;
    language?: string;
    placeholders?: Record<string, string>;
  }) => postJson<{ subject: string; body: string }>("templates/generate", input),

  populatePlaceholders: (input: {
    placeholders: string[];
    role: string;
    candidate_user_id?: string;
    job_id?: string;
  }) => postJson<{ populated: Record<string, string> }>("templates/populate", input),

  getFavorites: () =>
    request<{ status: string; favorites: string[] }>(`templates/favorites?user_id=${getUserId()}`),

  toggleFavorite: (templateId: string, isFavorite: boolean) =>
    postJson<{ status: string }>("templates/favorite", {
      user_id: getUserId(),
      template_id: templateId,
      is_favorite: isFavorite,
    }),

  trackUsage: (templateId: string) =>
    request<{ status: string; use_count: number; source?: string }>(`templates/track-usage?template_id=${encodeURIComponent(templateId)}`, { method: "POST" }),

  getPopularTemplates: () =>
    request<string[]>("templates/popular"),
};

export interface PipelineStageUpdate {
  id: string;
  employer_id: string;
  application_id?: string;
  candidate_user_id?: string;
  candidate_name: string;
  job_title: string;
  stage: string;
  stage_index: number;
  note: string;
  updated_at: string;
}

export interface PipelineUpdateIn {
  employer_id: string;
  application_id?: string | null;
  candidate_user_id?: string | null;
  candidate_name: string;
  job_title: string;
  stage: string;
  stage_index: number;
  note?: string;
}

export const PIPELINE_STAGES = [
  { label: "Application Received", icon: "📥", color: "#3b82f6" },
  { label: "Under Review", icon: "🔍", color: "#6366f1" },
  { label: "Shortlisted", icon: "⭐", color: "#8b5cf6" },
  { label: "Interview Scheduled", icon: "📅", color: "#a855f7" },
  { label: "Assessment", icon: "📝", color: "#f59e0b" },
  { label: "Offer Extended", icon: "🎯", color: "#10b981" },
  { label: "Hired", icon: "✅", color: "#22c55e" },
] as const;

export const PIPELINE_REJECTED = {
  label: "Rejected",
  icon: "✗",
  color: "#ef4444",
};
