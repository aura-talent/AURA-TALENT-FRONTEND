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
      if (data.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* non-JSON error body */ }
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
  evaluation_id: number;
  date: string;
  company: string;
  role: string;
  score: number;
  status: string;
  notes: string;
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

/* ── Endpoints ── */

export const api = {
  getResume: () => request<ResumeData>(`resume/${getUserId()}`),

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

  selfWorth: (input: { location?: string; currency?: string } = {}) =>
    postJson<SelfWorthEstimate>("salary/self", { user_id: getUserId(), ...input }),

  suggestions: (input: { jd_text?: string; jd_url?: string }) =>
    postJson<{ suggestions_markdown: string }>("resume/suggestions", {
      user_id: getUserId(),
      ...input,
    }),

  scan: (input: { companies?: string[]; title_keywords?: string[]; location_keywords?: string[] } = {}) =>
    postJson<{ total: number; jobs: JobPosting[]; errors: string[] }>("scan", input),


  listApplications: () => request<Application[]>(`applications/${getUserId()}`),

  getReport: (id: number) =>
    request<{ evaluation_id: number; report_markdown: string }>(
      `applications/${getUserId()}/${id}/report`
    ),

  updateStatus: (id: number, status: string, notes?: string) =>
    request<{ ok: boolean }>(`applications/${getUserId()}/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, notes }),
    }),

  saveUser: (input: { id: string; email: string | null; full_name: string | null; avatar_url: string | null; role?: string | null }) =>
    postJson<{ ok: boolean }>("users", input),

  getUserProfile: (userId: string) =>
    request<{ id: string; email: string | null; full_name: string | null; avatar_url: string | null; role: string }>(`users/${userId}`),

  migrateUser: (input: { anon_id: string; auth_id: string }) =>
    postJson<{ ok: boolean }>("users/migrate", input),
};

export const STATUSES = [
  "Evaluated", "Applied", "Responded", "Interview",
  "Offer", "Rejected", "Discarded", "SKIP",
] as const;
