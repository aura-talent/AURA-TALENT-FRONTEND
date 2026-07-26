"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  currentPhaseProgress,
  getJobConfig,
  nextPhaseId,
  type JobPipelineConfig,
  type PhaseProgress,
} from "@/app/employer/pipelineConfig";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type EmployerJobPlan,
  type PhaseDef,
} from "@/lib/employerApi";
import KanbanBoard, { type KanbanColumn } from "@/components/kanban";

const PLANNING_EMPTY_CONTENT = (
  <>
    Nothing here yet — new roles start in Planning while the role,
    requirements, and salary range are being defined. Head to{" "}
    <Link href="/employer/workforce">Workforce planning</Link> to set one up.
  </>
);

export default function HiringPipelineBoard({
  jobs,
  phases,
  plans,
  candidates = [],
}: {
  jobs: EmployerJob[];
  phases: PhaseDef[];
  plans: EmployerJobPlan[];
  candidates?: CandidateRow[];
}) {
  const router = useRouter();
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);

  const plansByJob = Object.fromEntries(plans.map((plan) => [plan.job_id, plan]));

  function effectivePhase(job: EmployerJob): string {
    return phaseOverrides[job.id] ?? job.pipeline_phase;
  }

  // Each job's pipeline config now lives on the job row (automation_level,
  // phase_targets), so it derives synchronously from the already-fetched jobs —
  // no post-mount localStorage load, no hydration concern.
  const configs = useMemo(() => {
    const next: Record<string, JobPipelineConfig> = {};
    for (const job of jobs) {
      next[job.id] = getJobConfig(job, phases, plansByJob[job.id]?.openings ?? 1);
    }
    return next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, phases, plans]);

  const columns: KanbanColumn[] = phases.map((phase) => ({
    id: phase.id,
    label: phase.label,
    color: phase.color,
    emptyContent: phase.id === "planning" ? PLANNING_EMPTY_CONTENT : undefined,
  }));

  // Phases with nothing in them start collapsed — the board opens showing
  // only where work actually is. Computed once from the first render's data
  // so later moves don't re-collapse a phase the employer just opened.
  const [emptyPhaseIds] = useState(() =>
    phases
      .filter((phase) => !jobs.some((job) => job.pipeline_phase === phase.id))
      .map((phase) => phase.id),
  );

  function handleMove(jobId: string, toPhaseId: string, trigger: "manual" | "auto" = "manual") {
    const previous = phaseOverrides[jobId];
    setPhaseOverrides((current) => ({ ...current, [jobId]: toPhaseId }));
    // advancePhase writes a job_phase_events audit row (feeds the activity
    // feed) in addition to moving the phase.
    employerApi
      .advancePhase(jobId, { to_phase: toPhaseId, trigger })
      .then((res) => {
        if (!res.advanced) {
          setPhaseOverrides((current) => ({ ...current, [jobId]: previous }));
        }
      })
      .catch((err) => {
        console.error("Failed to move job phase:", err);
        setPhaseOverrides((current) => ({ ...current, [jobId]: previous }));
      });
  }

  function progressFor(job: EmployerJob): PhaseProgress | null {
    const config = configs[job.id];
    if (!config) return null;
    const current = effectivePhase(job);
    // Only surface progress for the phase the card is actually sitting in.
    if (current !== job.pipeline_phase) return null;
    return currentPhaseProgress(job, candidates, config);
  }

  // Auto-advance is the BACKEND's job, not the browser's. This component used
  // to run its own advance loop here, POSTing /advance without require_target
  // — which made the server treat an automated move as a human one and skip
  // the Evaluation handoff gate entirely (pipeline_engine.AUTOMATION_HANDOFF_PHASE),
  // walking auto jobs into the offer phase before anyone was shortlisted.
  // The scheduler (app/employer/scheduler.py, every 60s) is now the single
  // owner of auto-advance; this board only moves jobs when a human drags one.

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const applicants = (job: EmployerJob) => job.stats?.applicant_count ?? 0;

  const metricNoun: Record<PhaseProgress["metric"], string> = {
    applicants: "applicants",
    evaluated: "evaluated",
    selected: "selected for offer",
    offers: "at offer",
    hires: "hired",
    manual: "",
  };

  function renderPhaseTarget(job: EmployerJob) {
    const progress = progressFor(job);
    if (!progress || progress.isManualGate) return null;
    const to = nextPhaseId(effectivePhase(job), phases);
    const pct = progress.targetCount
      ? Math.min(100, Math.round((progress.currentCount / progress.targetCount) * 100))
      : 0;
    const canAdvance = progress.met && !!to;
    return (
      <div style={{ marginTop: "0.55rem", borderTop: "1px dashed var(--ink-06)", paddingTop: "0.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.66rem", color: "var(--ink-55)", marginBottom: "0.3rem" }}>
          <span>
            {progress.currentCount}/{progress.targetCount} {metricNoun[progress.metric]}
          </span>
          <span style={{ fontWeight: 700 }}>
            {progress.met ? "Target met ✓" : `${progress.automation === "auto" ? "Auto" : "Manual"}`}
          </span>
        </div>
        <div style={{ height: "5px", borderRadius: "999px", background: "var(--ink-06)", overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: progress.met ? "#16a34a" : "var(--iris)" }} />
        </div>
        {canAdvance && progress.automation === "manual" && (
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.66rem", color: "#16a34a", fontWeight: 650, display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span aria-hidden="true">●</span> Ready to advance — open to move it
          </p>
        )}
        {canAdvance && progress.automation === "auto" && (
          <p style={{ margin: "0.45rem 0 0", fontSize: "0.66rem", color: "#16a34a", fontWeight: 650 }}>
            Auto-advancing…
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: "1.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "var(--ink-92, #1a1d29)",
            color: "#fff",
            padding: "0.6rem 1rem",
            borderRadius: "999px",
            fontSize: "0.78rem",
            fontWeight: 600,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
          }}
        >
          ⚡ {toast}
        </div>
      )}
      <KanbanBoard
        columns={columns}
        items={jobs}
        getItemId={(job) => job.id}
        getItemColumnId={effectivePhase}
        onCardClick={(job) => router.push(`/employer/jobs/${job.id}`)}
        onMove={handleMove}
        emptyLabel="No jobs in this phase."
        collapsible
        initialCollapsed={emptyPhaseIds}
        renderCard={(job) => (
          <>
            <div style={{ marginBottom: "0.4rem" }}>
              <strong style={{ fontSize: "0.84rem" }}>{job.title}</strong>
            </div>
            <small style={{ display: "block", color: "var(--ink-55)", fontSize: "0.72rem", marginBottom: "0.6rem" }}>
              {job.team ?? "—"} · {job.location ?? "—"}
            </small>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--ink-06)", paddingTop: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>
                {applicants(job)} candidate{applicants(job) === 1 ? "" : "s"}
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.76rem", color: "var(--iris-deep)" }}>
                {job.stats?.interview_count ?? 0} interview{(job.stats?.interview_count ?? 0) === 1 ? "" : "s"}
              </span>
            </div>
            {renderPhaseTarget(job)}
          </>
        )}
      />
    </>
  );
}
