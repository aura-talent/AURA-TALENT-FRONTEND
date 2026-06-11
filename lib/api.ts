/**
 * Client-side API helpers. Everything goes through the /api/backend proxy
 * so the backend API key never reaches the browser.
 */

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
  const headers = {
    "Accept": "application/json",
    ...init?.headers,
  };
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

  saveUser: (input: { id: string; email: string | null; full_name: string | null; avatar_url: string | null }) =>
    postJson<{ ok: boolean }>("users", input),

  migrateUser: (input: { anon_id: string; auth_id: string }) =>
    postJson<{ ok: boolean }>("users/migrate", input),
};

export const STATUSES = [
  "Evaluated", "Applied", "Responded", "Interview",
  "Offer", "Rejected", "Discarded", "SKIP",
] as const;
