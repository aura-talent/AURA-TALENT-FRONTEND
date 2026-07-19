"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { planStatusChipClass } from "@/app/employer/data";
import {
  currentPhaseProgress,
  getJobConfig,
  nextPhaseId,
  type JobPipelineConfig,
  type PhaseProgress,
} from "@/app/employer/pipelineConfig";
import {
  employerApi,
  formatSalary,
  type CandidateRow,
  type EmployerJob,
  type EmployerJobPlan,
  type PhaseDef,
} from "@/lib/employerApi";
import KanbanBoard, { type KanbanColumn } from "@/components/kanban";
import SideDrawer from "@/components/drawer";
import JobActivityFeed from "@/components/employer/JobActivityFeed";

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
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // Guards deterministic auto-advance so a given job never advances twice out
  // of the same phase within a session (keyed `${jobId}:${fromPhase}`).
  const autoAdvancedRef = useRef<Set<string>>(new Set());

  const plansByJob = Object.fromEntries(plans.map((plan) => [plan.job_id, plan]));
  const phaseLabel: Record<string, string> = Object.fromEntries(
    phases.map((phase) => [phase.id, phase.label]),
  );
  const hasClosedPhase = phases.some((phase) => phase.id === "closed");

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

  // Deterministic auto-advance: when a job's current phase is set to "auto"
  // and its target is met, move it to the next phase once. This fires from an
  // effect (not during render) and is guarded per job+phase to avoid loops.
  useEffect(() => {
    if (Object.keys(configs).length === 0) return;
    for (const job of jobs) {
      const fromPhase = effectivePhase(job);
      if (fromPhase !== job.pipeline_phase) continue;
      const progress = progressFor(job);
      if (!progress || progress.automation !== "auto" || !progress.met) continue;
      const to = nextPhaseId(fromPhase, phases);
      if (!to) continue;
      const guard = `${job.id}:${fromPhase}`;
      if (autoAdvancedRef.current.has(guard)) continue;
      autoAdvancedRef.current.add(guard);
      handleMove(job.id, to, "auto");
      setToast(
        `${job.title} auto-advanced to ${phaseLabel[to] ?? to} — target met.`,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configs, candidates, jobs, phaseOverrides]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedJob = jobs.find((job) => job.id === selectedId);
  const selectedPlan = selectedJob ? plansByJob[selectedJob.id] : undefined;
  const applicants = (job: EmployerJob) => job.stats?.applicant_count ?? 0;

  const metricNoun: Record<PhaseProgress["metric"], string> = {
    applicants: "applicants",
    evaluated: "evaluated",
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
        onCardClick={(job) => setSelectedId(job.id)}
        onMove={handleMove}
        emptyLabel="No jobs in this phase."
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

      <SideDrawer open={!!selectedJob} onClose={() => setSelectedId(null)}>
        {selectedJob && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--ink-06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>
                  {phaseLabel[effectivePhase(selectedJob)] ?? effectivePhase(selectedJob)}
                </p>
                <h2 style={{ fontSize: "1.2rem" }}>{selectedJob.title}</h2>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelectedId(null)}>
                ✕ Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", background: "rgba(26,29,41,0.015)", padding: "1rem", borderRadius: "var(--r-s)", border: "1px solid var(--ink-06)" }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>TEAM</span>
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.team ?? "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>LOCATION</span>
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.location ?? "—"}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>SALARY</span>
                  <strong style={{ fontSize: "0.85rem" }}>{formatSalary(selectedJob)}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>CANDIDATES</span>
                  <strong style={{ fontSize: "0.85rem" }}>{applicants(selectedJob)}</strong>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(26,29,41,0.015)", padding: "0.85rem 1rem", borderRadius: "var(--r-s)", border: "1px solid var(--ink-06)" }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.35rem" }}>WORKFORCE PLAN</span>
                  {selectedPlan ? (
                    <span className={`chip ${planStatusChipClass(selectedPlan.status)}`}>
                      {selectedPlan.status} · {selectedPlan.openings} opening{selectedPlan.openings === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="signal-missing">No plan yet</span>
                  )}
                </div>
                <Link className="table-action" href={`/employer/workforce/${selectedJob.id}`}>
                  {selectedPlan ? "Open plan →" : "Start planning →"}
                </Link>
              </div>

              {(() => {
                const progress = progressFor(selectedJob);
                const to = nextPhaseId(effectivePhase(selectedJob), phases);
                if (!to) return null;
                const showTarget = progress && !progress.isManualGate;
                return (
                  <div style={{ background: "rgba(26,29,41,0.015)", padding: "0.85rem 1rem", borderRadius: "var(--r-s)", border: "1px solid var(--ink-06)" }}>
                    <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.5rem" }}>ADVANCE PHASE</span>
                    {showTarget && (
                      <p style={{ margin: "0 0 0.6rem", fontSize: "0.76rem", color: progress!.met ? "#16a34a" : "var(--ink-55)", fontWeight: 600 }}>
                        {progress!.currentCount}/{progress!.targetCount} {metricNoun[progress!.metric]}
                        {progress!.met ? " · target met ✓" : " · target not met yet"}
                      </p>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => handleMove(selectedJob.id, to)}
                    >
                      Advance to {phaseLabel[to] ?? to} →
                    </button>
                  </div>
                );
              })()}

              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.5rem" }}>DESCRIPTION</p>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-72)", lineHeight: 1.6 }}>{selectedJob.description ?? "No description yet."}</p>
              </div>

              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.5rem" }}>KEYWORDS</p>
                <div className="talent-pool-tags">
                  {selectedJob.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>

              <JobActivityFeed job={selectedJob} compact />
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--ink-06)", display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
              <Link className="btn btn-ghost" href={`/employer/jobs/${selectedJob.id}/applicants`} style={{ flex: 1, justifyContent: "center" }}>
                View applicants
              </Link>
              <Link className="btn btn-primary" href={`/employer/jobs/${selectedJob.id}`} style={{ flex: 1, justifyContent: "center" }}>
                Full job page →
              </Link>
              {hasClosedPhase && effectivePhase(selectedJob) !== "closed" && (
                <button
                  className="btn btn-ghost"
                  style={{ flexBasis: "100%", justifyContent: "center", color: "#dc2626" }}
                  onClick={() => handleMove(selectedJob.id, "closed")}
                >
                  Close this job
                </button>
              )}
            </div>
          </div>
        )}
      </SideDrawer>
    </>
  );
}
