/**
 * Employer-side API client. Same conventions as lib/api.ts: everything goes
 * through the /api/backend proxy, and the logged-in Supabase user id (via
 * getUserId) is the employer_id the backend role-checks.
 *
 * Types mirror the FastAPI rows (snake_case) from
 * AURA-TALENT-BACKEND/app/employer — the DB is the source of truth now, not
 * app/employer/data.ts.
 */
import { getUserId, ApiError } from "./api";
import { supabase } from "./supabaseClient";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let token: string | null = null;
  try {
    const sessionRes = await supabase.auth.getSession();
    token = sessionRes.data.session?.access_token ?? null;
  } catch (err) {
    console.error("Failed to get session token:", err);
  }

  const headers = new Headers(init?.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  headers.set("Accept", "application/json");

  const resp = await fetch(`/api/backend/employer/${path}`, { ...init, headers });
  if (!resp.ok) {
    let detail = `Request failed (${resp.status})`;
    try {
      const data = await resp.json();
      if (data.detail)
        detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(resp.status, detail);
  }
  return resp.json();
}

function jsonBody<T>(path: string, method: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const eid = () => `employer_id=${encodeURIComponent(getUserId())}`;

/* ── Types (mirroring backend rows) ── */

export type StageDef = { label: string; color: string; is_rejected: boolean };
export type PhaseDef = { id: string; label: string; color: string };

/** Per-phase advance target stored on jobs.phase_targets (0002). */
export type PhaseTargetRow = { phaseId: string; metric: string; targetCount: number };

export interface JobStats {
  applicant_count?: number;
  active_applicant_count?: number;
  interview_count?: number;
}

export interface EmployerJob {
  id: string;
  employer_id: string;
  title: string;
  team: string | null;
  location: string | null;
  employment_type: string | null;
  salary_low: number | null;
  salary_high: number | null;
  salary_currency: string;
  description: string | null;
  keywords: string[];
  status: "Active" | "Draft";
  pipeline_phase: string;
  automation_level: "auto" | "manual";
  phase_targets: PhaseTargetRow[];
  mock_interview_enabled: boolean;
  interview_questions: string[];
  job_application_stages: StageDef[];
  metric_priorities: Record<string, number>;
  dimension_weights: Record<string, number>;
  custom_criteria: { name: string; priority: number }[];
  created_at: string;
  updated_at: string;
  headhunter_ids: string[];
  stats?: JobStats;
}

export interface HeadhunterStats {
  candidates_sourced?: number;
  avg_match_score?: number | null;
  last_active_at?: string | null;
}

export interface EmployerHeadhunter {
  id: string;
  employer_id: string;
  name: string;
  persona: string | null;
  status: "Draft" | "Active" | "Paused";
  focus_areas: string[];
  created_at: string;
  updated_at: string;
  stats: HeadhunterStats;
  job_ids: string[];
}

export interface JobApplication {
  id: string;
  job_id: string;
  candidate_user_id: string;
  stage: string;
  is_rejected: boolean;
  applied_at: string;
  updated_at: string;
}

export interface CandidateEvaluation {
  id: string;
  job_id: string;
  candidate_user_id: string;
  source: "applied" | "aura" | "headhunter";
  headhunter_id: string | null;
  resume_score: number | null;
  interview_score: number | null;
  metrics: Record<string, number> | null;
  rubric: Record<string, number> | null;
  wlc_score: number | null;
  matched_keywords: string[];
  match_summary: string | null;
  evidence: string[];
  interview_evaluation: InterviewEvaluationData | null;
  created_at: string;
  updated_at: string;
  job_title?: string;
}

export interface InterviewEvaluationData {
  completedAt?: string;
  duration?: string;
  mode?: string;
  scores?: Record<string, number>;
  summary?: string;
  responses?: { question: string; response: string; score: number; evidence: string }[];
}

/** One (job, candidate) row from the consolidated /talent-pool/candidates. */
export interface CandidateRow {
  candidate_user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  job_id: string;
  job_title: string;
  job_application_stages: StageDef[] | null;
  application: JobApplication | null;
  evaluation: CandidateEvaluation | null;
}

export interface CandidateDetail {
  id: string;
  candidate_user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  resume_markdown: string | null;
  rows: CandidateRow[];
}

export interface TalentPoolEntry {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  resume: { user_id: string; markdown: string; updated_at: string } | null;
  evaluations?: CandidateEvaluation[];
  evaluation?: CandidateEvaluation | null;
}

export interface EmployerJobPlan {
  id?: string;
  job_id: string;
  status: "Draft" | "Approved" | "Published";
  priority: string | null;
  backfill: boolean;
  openings: number;
  baseline_headcount: number | null;
  budget: number | null;
  hiring_manager: string | null;
  target_start_date: string | null;
  target_fill_date: string | null;
  justification: string | null;
  demand_signal_reason: string | null;
  demand_signal_risk: string | null;
  updated_at?: string;
  job_title?: string;
  job_status?: string;
}

export interface EmployerProfile {
  user_id: string;
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  headquarters: string | null;
  about: string | null;
  culture_values: string[];
  career_growth: string | null;
  logo_url: string | null;
  hiring_pipeline_phases: PhaseDef[];
  updated_at: string;
}

export interface StageEvent {
  id: string;
  job_application_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  note: string | null;
  created_at: string;
}

/* ── Pipeline automation / offers / comms / suggestions (0002) ── */

export interface PhaseProgress {
  phaseId: string | null;
  metric: string;
  currentCount: number;
  targetCount: number;
  met: boolean;
  isManualGate: boolean;
}

export interface JobPhaseProgress {
  current_phase: string | null;
  next_phase: string | null;
  automation_level: "auto" | "manual";
  progress: PhaseProgress;
}

export interface AdvanceResult {
  advanced: boolean;
  reason?: string;
  from_phase?: string;
  to_phase?: string;
  trigger?: string;
  job?: EmployerJob;
  progress?: PhaseProgress;
  current_phase?: string | null;
}

export interface JobPhaseEvent {
  id: string;
  job_id: string;
  from_phase: string | null;
  to_phase: string;
  changed_by: string | null;
  trigger: string;
  note: string | null;
  created_at: string;
}

export interface Offer {
  id: string;
  job_id: string;
  candidate_user_id: string;
  status: "sent" | "accepted" | "declined" | "rescinded";
  email_subject: string | null;
  email_body: string | null;
  sent_at: string;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommsMessage {
  id: string;
  job_id: string | null;
  candidate_user_id: string | null;
  sender_id: string | null;
  channel: string;
  subject: string | null;
  body: string | null;
  template_id: string | null;
  status: "draft" | "queued" | "sent" | "failed";
  error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface CommsDraft {
  subject: string;
  body: string;
}

export interface SuggestedAction {
  id: string;
  employer_id: string;
  job_id: string | null;
  candidate_user_id: string | null;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  status: "open" | "done" | "dismissed";
  source: string;
  created_at: string;
  updated_at: string;
}

export interface JobDraftResult {
  draft: {
    title: string;
    team: string | null;
    location: string | null;
    employment_type: string | null;
    salary_low: number | null;
    salary_high: number | null;
    salary_currency: string;
    description: string;
    keywords: string[];
  };
  interview_questions: string[];
}

export interface PlanDraftResult {
  priority: string | null;
  openings: number;
  baseline_headcount: number | null;
  budget: number | null;
  target_start_date: string | null;
  target_fill_date: string | null;
  justification: string;
  demand_signal_reason: string | null;
  demand_signal_risk: string | null;
}

export interface EmployerProfileDraft {
  company_name: string | null;
  industry: string | null;
  company_size: string | null;
  headquarters: string | null;
  about: string | null;
  culture_values: string[];
  career_growth: string | null;
}

/* ── Payload types ── */

export type JobPayload = Partial<
  Omit<EmployerJob, "id" | "employer_id" | "created_at" | "updated_at" | "stats">
>;

export type JobPlanPayload = Omit<
  EmployerJobPlan,
  "id" | "job_id" | "updated_at" | "job_title" | "job_status"
>;

/* ── Endpoints ── */

export const employerApi = {
  /* jobs */
  listJobs: () => request<EmployerJob[]>(`jobs?${eid()}`),
  getJob: (jobId: string) => request<EmployerJob>(`jobs/${jobId}?${eid()}`),
  createJob: (payload: JobPayload) =>
    jsonBody<EmployerJob>(`jobs`, "POST", { ...payload, employer_id: getUserId() }),
  updateJob: (jobId: string, payload: JobPayload) =>
    jsonBody<EmployerJob>(`jobs/${jobId}?${eid()}`, "PATCH", payload),
  deleteJob: (jobId: string) =>
    request<{ ok: boolean }>(`jobs/${jobId}?${eid()}`, { method: "DELETE" }),

  /* candidates (consolidated rows) + talent pool */
  listCandidates: (jobId?: string) =>
    request<CandidateRow[]>(
      `talent-pool/candidates?${eid()}${jobId ? `&job_id=${jobId}` : ""}`,
    ),
  getCandidate: (candidateUserId: string) =>
    request<CandidateDetail>(`talent-pool/candidates/${candidateUserId}?${eid()}`),
  browsePool: (jobId?: string) =>
    request<TalentPoolEntry[]>(
      `talent-pool?${eid()}${jobId ? `&job_id=${jobId}` : ""}`,
    ),

  /* applications / pipeline */
  listApplications: (jobId: string) =>
    request<JobApplication[]>(`applications?job_id=${jobId}&${eid()}`),
  createApplication: (jobId: string, candidateUserId: string, stage?: string) =>
    jsonBody<JobApplication>(`applications`, "POST", {
      job_id: jobId,
      candidate_user_id: candidateUserId,
      stage,
    }),
  moveStage: (applicationId: string, toStage: string, note?: string) =>
    jsonBody<JobApplication>(`applications/${applicationId}/stage`, "POST", {
      employer_id: getUserId(),
      to_stage: toStage,
      note,
    }),
  stageHistory: (applicationId: string) =>
    request<StageEvent[]>(`applications/${applicationId}/events?${eid()}`),

  /* headhunters */
  listHeadhunters: () => request<EmployerHeadhunter[]>(`headhunters?${eid()}`),
  getHeadhunter: (id: string) =>
    request<EmployerHeadhunter>(`headhunters/${id}?${eid()}`),
  createHeadhunter: (payload: {
    name: string;
    persona?: string;
    status?: string;
    focus_areas?: string[];
  }) =>
    jsonBody<EmployerHeadhunter>(`headhunters`, "POST", {
      ...payload,
      employer_id: getUserId(),
    }),
  updateHeadhunter: (
    id: string,
    payload: { name?: string; persona?: string; status?: string; focus_areas?: string[] },
  ) => jsonBody<EmployerHeadhunter>(`headhunters/${id}?${eid()}`, "PATCH", payload),
  deleteHeadhunter: (id: string) =>
    request<{ ok: boolean }>(`headhunters/${id}?${eid()}`, { method: "DELETE" }),
  setHeadhunterJobs: (id: string, jobIds: string[]) =>
    jsonBody<{ job_ids: string[] }>(`headhunters/${id}/jobs?${eid()}`, "PUT", jobIds),

  /* workforce plans */
  listJobPlans: () => request<EmployerJobPlan[]>(`job-plans?${eid()}`),
  getJobPlan: (jobId: string) =>
    request<EmployerJobPlan>(`job-plans/${jobId}?${eid()}`),
  upsertJobPlan: (jobId: string, payload: Partial<JobPlanPayload>) =>
    jsonBody<EmployerJobPlan>(`job-plans/${jobId}?${eid()}`, "PUT", payload),

  /* profile */
  getProfile: () => request<EmployerProfile>(`profile/${getUserId()}`),
  upsertProfile: (payload: Partial<Omit<EmployerProfile, "user_id" | "updated_at">>) =>
    jsonBody<EmployerProfile>(`profile/${getUserId()}`, "PUT", payload),
  importProfile: (payload: { source_url?: string; raw_text?: string }) =>
    jsonBody<EmployerProfileDraft>(`profile/import`, "POST", {
      ...payload,
      employer_id: getUserId(),
    }),

  /* pipeline automation: phase advance + progress + audit (0002) */
  phaseProgress: (jobId: string) =>
    request<JobPhaseProgress>(`jobs/${jobId}/phase-progress?${eid()}`),
  advancePhase: (
    jobId: string,
    opts?: { to_phase?: string; trigger?: string; note?: string; require_target?: boolean },
  ) =>
    jsonBody<AdvanceResult>(`jobs/${jobId}/advance`, "POST", {
      employer_id: getUserId(),
      ...opts,
    }),
  phaseEvents: (jobId: string) =>
    request<JobPhaseEvent[]>(`jobs/${jobId}/phase-events?${eid()}`),

  /* offers (0002) — replaces offerStore localStorage */
  listOffers: (jobId: string) => request<Offer[]>(`offers?job_id=${jobId}&${eid()}`),
  createOffer: (
    jobId: string,
    candidateUserId: string,
    opts?: { email_subject?: string; email_body?: string },
  ) =>
    jsonBody<Offer>(`offers`, "POST", {
      job_id: jobId,
      candidate_user_id: candidateUserId,
      employer_id: getUserId(),
      ...opts,
    }),
  updateOffer: (jobId: string, candidateUserId: string, status: Offer["status"]) =>
    jsonBody<Offer>(`offers/${jobId}/${candidateUserId}`, "PATCH", {
      employer_id: getUserId(),
      status,
    }),

  /* comms (0002) — real send + agent-drafted generate */
  listComms: (opts: { jobId?: string; candidateUserId?: string }) =>
    request<CommsMessage[]>(
      `comms?${eid()}${opts.jobId ? `&job_id=${opts.jobId}` : ""}${
        opts.candidateUserId ? `&candidate_user_id=${opts.candidateUserId}` : ""
      }`,
    ),
  generateComms: (payload: {
    candidate_user_id: string;
    job_id?: string;
    kind?: string;
    instructions?: string;
  }) =>
    jsonBody<CommsDraft>(`comms/generate`, "POST", { ...payload, employer_id: getUserId() }),
  sendComms: (payload: {
    candidate_user_id: string;
    subject: string;
    body: string;
    job_id?: string;
    template_id?: string;
    is_offer?: boolean;
  }) => jsonBody<CommsMessage>(`comms/send`, "POST", { ...payload, employer_id: getUserId() }),

  /* suggested actions (0002) — agent-emitted, persisted */
  listSuggestedActions: (status = "open") =>
    request<SuggestedAction[]>(`suggested-actions?${eid()}&status=${status}`),
  updateSuggestedAction: (actionId: string, status: SuggestedAction["status"]) =>
    jsonBody<SuggestedAction>(`suggested-actions/${actionId}`, "PATCH", {
      employer_id: getUserId(),
      status,
    }),

  /* agent triggers (graphs owned by backend; these wire the UI to them) */
  triggerEvaluation: (
    jobId: string,
    candidateUserId: string,
    source: "applied" | "aura" | "headhunter" = "aura",
  ) =>
    jsonBody<{ ok: boolean; status: string }>(`talent-pool/evaluate/trigger`, "POST", {
      job_id: jobId,
      candidate_user_id: candidateUserId,
      employer_id: getUserId(),
      source,
    }),
  sourceHeadhunter: (headhunterId: string, jobId: string) =>
    jsonBody<{ status: string }>(
      `headhunters/${headhunterId}/source?job_id=${jobId}&${eid()}`,
      "POST",
      {},
    ),
  draftJob: (payload: {
    mode: "aura" | "url";
    brief?: string;
    jd_url?: string;
    question_count?: number;
  }) => jsonBody<JobDraftResult>(`jobs/draft`, "POST", { ...payload, employer_id: getUserId() }),
  draftPlan: (payload: { job_id?: string; brief?: string; title?: string }) =>
    jsonBody<PlanDraftResult>(`job-plans/draft`, "POST", {
      ...payload,
      employer_id: getUserId(),
    }),
  nextActions: (candidateUserId: string, jobId?: string) =>
    jsonBody<{ actions: SuggestedAction[] }>(
      `talent-pool/candidates/${candidateUserId}/next-actions`,
      "POST",
      { employer_id: getUserId(), job_id: jobId },
    ),
  runSupervisor: (jobId: string) =>
    jsonBody<{ suggestions: SuggestedAction[]; auto_advanced: AdvanceResult }>(
      `jobs/${jobId}/run?${eid()}`,
      "POST",
      {},
    ),
};

/* ── Display helpers shared by employer pages ── */

export function candidateInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function formatSalary(job: EmployerJob): string {
  if (job.salary_low == null && job.salary_high == null) return "—";
  const fmt = (n: number) => n.toLocaleString();
  if (job.salary_low != null && job.salary_high != null)
    return `${job.salary_currency} ${fmt(job.salary_low)}–${fmt(job.salary_high)}`;
  return `${job.salary_currency} ${fmt((job.salary_low ?? job.salary_high)!)}`;
}

export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.floor(days)}d ago`;
  return new Date(iso).toLocaleDateString();
}
