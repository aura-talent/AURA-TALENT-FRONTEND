/**
 * Per-job pipeline config.
 *
 * Two independent things layer onto a job's hiring pipeline:
 *
 *   - AUTOMATION LEVEL — a single job-level switch. "auto" advances the job
 *     through every phase automatically as each phase's target is met;
 *     "manual" (human) waits for the employer to advance each phase.
 *   - TARGETS — a per-phase measurable condition for leaving that phase
 *     (e.g. "5 applicants", "3 evaluated", "openings filled").
 *
 * Both are now persisted on the job row (jobs.automation_level,
 * jobs.phase_targets — migration 0002): `getJobConfig` reads them off the
 * already-loaded job, `saveJobConfig` writes them via employerApi.updateJob.
 * Progress counts are still derived CLIENT-SIDE from candidate rows we already
 * fetch (see `derivePhaseProgress`); the backend computes the same numbers for
 * the deterministic advance gate (services/pipeline_engine.py).
 */

import { employerApi } from "@/lib/employerApi";
import type { CandidateRow, EmployerJob, PhaseDef } from "@/lib/employerApi";

// The whole job is either fully automated or human-driven.
export type PhaseAutomation = "auto" | "manual";

// What "target met" measures for leaving a phase. "manual" means there is no
// measurable target — the phase is a pure gate (advance whenever ready).
export type PhaseMetric =
  | "applicants" // # candidates who have applied
  | "evaluated" // # candidates with an evaluation/score
  | "offers" // # candidates at an offer stage
  | "hires" // # candidates hired (vs plan openings)
  | "manual"; // gate, no auto condition

export type PhaseTarget = {
  phaseId: string; // matches a PhaseDef.id
  metric: PhaseMetric;
  targetCount: number;
};

export type JobPipelineConfig = {
  jobId: string;
  automation: PhaseAutomation;
  phases: PhaseTarget[];
};

export const PHASE_METRICS: { value: PhaseMetric; label: string }[] = [
  { value: "applicants", label: "Applicants received" },
  { value: "evaluated", label: "Candidates evaluated" },
  { value: "offers", label: "Offers at stage" },
  { value: "hires", label: "Candidates hired" },
  { value: "manual", label: "Manual gate (no target)" },
];

export const OFFER_PHASE_ID = "offer-decision";

// Sensible per-phase target defaults, keyed by well-known phase ids. Custom or
// unknown phases fall back to a manual gate.
function defaultTargetFor(phase: PhaseDef, openings: number): PhaseTarget {
  switch (phase.id) {
    case "open-hiring":
      return { phaseId: phase.id, metric: "applicants", targetCount: 5 };
    case "evaluation":
      return { phaseId: phase.id, metric: "evaluated", targetCount: 3 };
    case OFFER_PHASE_ID:
      return { phaseId: phase.id, metric: "hires", targetCount: Math.max(openings, 1) };
    default:
      return { phaseId: phase.id, metric: "manual", targetCount: 0 };
  }
}

export function defaultPipelineConfig(
  jobId: string,
  phases: PhaseDef[],
  openings = 1,
): JobPipelineConfig {
  return {
    jobId,
    automation: "manual", // human-in-the-loop by default
    phases: phases.map((phase) => defaultTargetFor(phase, openings)),
  };
}

// ── Persistence (job row: jobs.automation_level, jobs.phase_targets) ────────

/**
 * Build a job's pipeline config from its own columns, reconciled against the
 * current phase list: phases with no stored target get a default, stored
 * targets for phases that no longer exist are dropped. Pure/synchronous — the
 * job is already loaded by every caller.
 */
export function getJobConfig(
  job: EmployerJob,
  phases: PhaseDef[],
  openings = 1,
): JobPipelineConfig {
  const fallback = defaultPipelineConfig(job.id, phases, openings);
  const stored = job.phase_targets ?? [];
  const byId = new Map(stored.map((target) => [target.phaseId, target]));
  return {
    jobId: job.id,
    automation: job.automation_level === "auto" ? "auto" : "manual",
    phases: phases.map((phase, index) => {
      const t = byId.get(phase.id);
      return t
        ? { phaseId: t.phaseId, metric: t.metric as PhaseMetric, targetCount: t.targetCount }
        : fallback.phases[index];
    }),
  };
}

/** Persist automation + targets onto the job row. */
export async function saveJobConfig(config: JobPipelineConfig): Promise<void> {
  await employerApi.updateJob(config.jobId, {
    automation_level: config.automation,
    phase_targets: config.phases,
  });
}

// ── Progress derivation ───────────────────────────────────────────────────

export type PhaseProgress = {
  phaseId: string;
  metric: PhaseMetric;
  automation: PhaseAutomation;
  currentCount: number;
  targetCount: number;
  met: boolean;
  isManualGate: boolean;
};

const OFFER_STAGE_RE = /offer/i;
const HIRED_STAGE_RE = /hire|hired/i;

function countApplied(rows: CandidateRow[]): number {
  return rows.filter((row) => row.application).length;
}

function countEvaluated(rows: CandidateRow[]): number {
  return rows.filter((row) => row.evaluation).length;
}

function countStageMatches(rows: CandidateRow[], re: RegExp): number {
  return rows.filter((row) => row.application && re.test(row.application.stage)).length;
}

function currentForMetric(
  metric: PhaseMetric,
  rows: CandidateRow[],
  job: EmployerJob,
): number {
  switch (metric) {
    case "applicants":
      return job.stats?.applicant_count ?? countApplied(rows);
    case "evaluated":
      return countEvaluated(rows);
    case "offers":
      return countStageMatches(rows, OFFER_STAGE_RE);
    case "hires":
      return countStageMatches(rows, HIRED_STAGE_RE);
    case "manual":
    default:
      return 0;
  }
}

/**
 * Live progress for each configured phase target. The `automation` on each
 * entry is the job-level automation (copied through for convenience). A
 * "manual" metric never auto-satisfies — it's a gate.
 */
export function derivePhaseProgress(
  job: EmployerJob,
  candidates: CandidateRow[],
  config: JobPipelineConfig,
): PhaseProgress[] {
  const rows = candidates.filter((row) => row.job_id === job.id);
  return config.phases.map((target) => {
    const isManualGate = target.metric === "manual" || target.targetCount <= 0;
    const currentCount = currentForMetric(target.metric, rows, job);
    const met =
      !isManualGate && target.targetCount > 0 && currentCount >= target.targetCount;
    return {
      phaseId: target.phaseId,
      metric: target.metric,
      automation: config.automation,
      currentCount,
      targetCount: target.targetCount,
      met,
      isManualGate,
    };
  });
}

/** Progress for the job's CURRENT phase only, or null if not configured. */
export function currentPhaseProgress(
  job: EmployerJob,
  candidates: CandidateRow[],
  config: JobPipelineConfig,
): PhaseProgress | null {
  const all = derivePhaseProgress(job, candidates, config);
  return all.find((progress) => progress.phaseId === job.pipeline_phase) ?? null;
}

/** The phase id immediately after `phaseId` in order, or null if it's last. */
export function nextPhaseId(phaseId: string, phases: PhaseDef[]): string | null {
  const index = phases.findIndex((phase) => phase.id === phaseId);
  if (index < 0 || index >= phases.length - 1) return null;
  return phases[index + 1].id;
}
