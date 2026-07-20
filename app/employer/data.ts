/**
 * Employer-side UI constants and pure display helpers.
 *
 * All actual data (jobs, candidates, headhunters, plans, evaluations, stage
 * configs) now lives in Supabase and is fetched through lib/employerApi.ts.
 * What remains here is presentation-only: metric/dimension labels and
 * descriptions, default stage/phase lists used as fallbacks before a fetch
 * resolves (matching the DB column defaults), and chip-styling helpers.
 */

import type { PhaseDef, StageDef } from "@/lib/employerApi";

export type EvaluationMetricKey =
  | "reputation"
  | "match"
  | "northStar"
  | "compensation"
  | "culture"
  | "redFlags";

export const evaluationMetrics: Array<{
  key: EvaluationMetricKey;
  label: string;
  description: string;
}> = [
  {
    key: "reputation",
    label: "Reputational score",
    description: "Mock interview performance and evidence quality",
  },
  {
    key: "match",
    label: "Keyword match",
    description: "Resume evidence against prioritized role keywords",
  },
  {
    key: "northStar",
    label: "North Star alignment",
    description: "Career direction, motivation, and role outcomes",
  },
  {
    key: "compensation",
    label: "Compensation / allowance",
    description: "Salary expectations and total package alignment",
  },
  {
    key: "culture",
    label: "Cultural alignment",
    description: "Team behaviors and system alignment",
  },
  {
    key: "redFlags",
    label: "Red flag confidence",
    description: "Risk checks; a higher score means lower observed risk",
  },
];

export const defaultMetricPriorities: Record<EvaluationMetricKey, number> = {
  reputation: 9,
  match: 10,
  northStar: 9,
  compensation: 7,
  culture: 8,
  redFlags: 8,
};

export type ScoringDimensionKey =
  | "technical"
  | "problemSolving"
  | "communication"
  | "culture";

export const scoringDimensions: Array<{
  key: ScoringDimensionKey;
  label: string;
  weight: number;
  description: string;
}> = [
  {
    key: "technical",
    label: "Technical core",
    weight: 38,
    description: "Role knowledge, skills, and quality of technical evidence",
  },
  {
    key: "problemSolving",
    label: "Problem solving",
    weight: 25,
    description: "Reasoning, judgment, trade-offs, and adaptability",
  },
  {
    key: "communication",
    label: "Communication & behavioral",
    weight: 20,
    description: "Clarity, ownership, collaboration, and behavioral evidence",
  },
  {
    key: "culture",
    label: "Culture fit / system alignment",
    weight: 17,
    description: "North Star, compensation, culture, and risk alignment",
  },
];

export function weightedScore(
  scores: Record<string, number>,
  weights: Record<string, number> = Object.fromEntries(
    scoringDimensions.map((d) => [d.key, d.weight]),
  ),
) {
  const totalWeight = Object.values(weights).reduce((total, w) => total + w, 0);
  if (!totalWeight) return 0;
  const weightedTotal = Object.entries(weights).reduce(
    (total, [key, weight]) => total + (scores[key] ?? 0) * weight,
    0,
  );
  return Math.round(weightedTotal / totalWeight);
}

export const interviewEvaluationPriorities = [
  {
    key: "content",
    label: "Content",
    priority: 10,
    description: "Relevance, depth, examples, and role-specific knowledge",
  },
  {
    key: "clarity",
    label: "Clarity",
    priority: 8,
    description: "Structure, precision, and ease of understanding",
  },
  {
    key: "confidence",
    label: "Confidence",
    priority: 7,
    description: "Conviction, composure, and ownership of responses",
  },
  {
    key: "bodyLanguage",
    label: "Body language",
    priority: 5,
    description: "Eye contact, posture, expression, and visual presence",
  },
] as const;

export type InterviewEvaluationKey =
  (typeof interviewEvaluationPriorities)[number]["key"];

// ── Default stage/phase lists ─────────────────────────────────────────────
// These mirror the DB column defaults (jobs.job_application_stages and
// employer_profiles.hiring_pipeline_phases). They're the fallback while a
// fetch is in flight and the seed for brand-new jobs; the configured lists
// on the job/profile rows are the source of truth.

export const defaultApplicationStages: StageDef[] = [
  { label: "Application Received", color: "#475569", is_rejected: false },
  { label: "Under Review", color: "#2563eb", is_rejected: false },
  { label: "Shortlisted", color: "#4f46e5", is_rejected: false },
  { label: "Interview Scheduled", color: "#7c3aed", is_rejected: false },
  { label: "Assessment", color: "#d97706", is_rejected: false },
  { label: "Offer Extended", color: "#0d9488", is_rejected: false },
  { label: "Hired", color: "#16a34a", is_rejected: false },
  { label: "Rejected", color: "#dc2626", is_rejected: true },
];

export const defaultPipelinePhases: PhaseDef[] = [
  { id: "planning", label: "Planning", color: "#64748b" },
  { id: "open-hiring", label: "Open / Active Hiring", color: "#2563eb" },
  { id: "evaluation", label: "Evaluation", color: "#7c3aed" },
  { id: "offer-decision", label: "Offer / Decision", color: "#0d9488" },
  { id: "filled", label: "Filled", color: "#16a34a" },
  { id: "closed", label: "Closed", color: "#dc2626" },
];

/** Color for a stage label, looked up in a job's configured stage list
 * (falling back to the defaults above). */
export function stageColor(stage: string, stages?: StageDef[] | null): string {
  const list = stages?.length ? stages : defaultApplicationStages;
  return list.find((step) => step.label === stage)?.color ?? "var(--ink-55)";
}

// Phases that mean the role is no longer actively hiring. A job's lifecycle is
// now expressed through its pipeline phase rather than the Draft/Active status.
const NON_OPEN_PHASE_IDS = ["planning", "filled", "closed"];

/** Whether a job is actively hiring, based on its pipeline phase. */
export function isJobOpen(job: { pipeline_phase: string }): boolean {
  return !NON_OPEN_PHASE_IDS.includes(job.pipeline_phase);
}

/** Resolve a phase id to its {id,label,color}, falling back to the defaults. */
export function phaseMeta(phaseId: string, phases?: PhaseDef[] | null): PhaseDef {
  const list = phases?.length ? phases : defaultPipelinePhases;
  return (
    list.find((phase) => phase.id === phaseId) ?? {
      id: phaseId,
      label: phaseId || "—",
      color: "#64748b",
    }
  );
}

// ── Chip styling helpers ──────────────────────────────────────────────────

export type PlanStatus = "Draft" | "Approved" | "Published";

export function planStatusChipClass(status: PlanStatus | string) {
  if (status === "Published") return "chip-tier-high";
  if (status === "Approved") return "chip-tier-caution";
  return "";
}

export type HeadhunterStatus = "Draft" | "Active" | "Paused";

export function headhunterStatusChipClass(status: HeadhunterStatus | string) {
  if (status === "Active") return "chip-tier-high";
  if (status === "Paused") return "chip-tier-caution";
  return "";
}

// Avatar marks are always derived from the name, never separately configured.
// Uses the last two words' initials (e.g. "Aura Technical Sourcer" -> "TS")
// so the shared "Aura ___" naming convention still differentiates agents.
export function headhunterInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const secondLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  return (secondLast[0] + last[0]).toUpperCase();
}
