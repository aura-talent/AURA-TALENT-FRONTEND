"use client";

import { useState } from "react";
import Link from "next/link";
import {
  jobPlans,
  jobs,
  pipelinePhases,
  planStatusChipClass,
  type PipelinePhaseId,
} from "@/app/employer/data";
import KanbanBoard, { type KanbanColumn } from "@/components/kanban";
import SideDrawer from "@/components/drawer";

type Job = (typeof jobs)[number];

const PLANNING_EMPTY_CONTENT = (
  <>
    Nothing here yet — new roles start in Planning while the role,
    requirements, and salary range are being defined. Head to{" "}
    <Link href="/employer/workforce">Workforce planning</Link> to set one up.
  </>
);

const PHASE_LABEL: Record<string, string> = Object.fromEntries(
  pipelinePhases.map((phase) => [phase.id, phase.label]),
);

export default function HiringPipelineBoard() {
  const [phaseOverrides, setPhaseOverrides] = useState<Record<string, PipelinePhaseId>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function effectivePhase(job: Job): string {
    return phaseOverrides[job.id] ?? job.pipelinePhase;
  }

  const columns: KanbanColumn[] = pipelinePhases.map((phase) => ({
    id: phase.id,
    label: phase.label,
    color: phase.color,
    emptyContent: phase.id === "planning" ? PLANNING_EMPTY_CONTENT : undefined,
  }));

  function handleMove(jobId: string, toPhaseId: string) {
    setPhaseOverrides((current) => ({
      ...current,
      [jobId]: toPhaseId as PipelinePhaseId,
    }));
  }

  const selectedJob = jobs.find((job) => job.id === selectedId);

  return (
    <>
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
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.4rem", gap: "0.5rem" }}>
              <strong style={{ fontSize: "0.84rem" }}>{job.title}</strong>
              <span className={`chip ${job.status === "Active" ? "chip-tier-high" : ""}`} style={{ fontSize: "0.58rem", flexShrink: 0 }}>
                {job.status}
              </span>
            </div>
            <small style={{ display: "block", color: "var(--ink-55)", fontSize: "0.72rem", marginBottom: "0.6rem" }}>
              {job.team} · {job.location}
            </small>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--ink-06)", paddingTop: "0.5rem" }}>
              <span style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>
                {job.candidates} candidate{job.candidates === 1 ? "" : "s"}
              </span>
              <span style={{ fontWeight: 700, fontSize: "0.76rem", color: "var(--iris-deep)" }}>
                {job.fit}% fit
              </span>
            </div>
          </>
        )}
      />

      <SideDrawer open={!!selectedJob} onClose={() => setSelectedId(null)}>
        {selectedJob && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--ink-06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>
                  {PHASE_LABEL[effectivePhase(selectedJob)]}
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
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.team}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>LOCATION</span>
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.location}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>SALARY</span>
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.salary}</strong>
                </div>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.25rem" }}>CANDIDATES</span>
                  <strong style={{ fontSize: "0.85rem" }}>{selectedJob.candidates}</strong>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", background: "rgba(26,29,41,0.015)", padding: "0.85rem 1rem", borderRadius: "var(--r-s)", border: "1px solid var(--ink-06)" }}>
                <div>
                  <span style={{ display: "block", fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.35rem" }}>WORKFORCE PLAN</span>
                  {jobPlans[selectedJob.id] ? (
                    <span className={`chip ${planStatusChipClass(jobPlans[selectedJob.id].status)}`}>
                      {jobPlans[selectedJob.id].status} · {jobPlans[selectedJob.id].openings} opening{jobPlans[selectedJob.id].openings === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="signal-missing">No plan yet</span>
                  )}
                </div>
                <Link className="table-action" href={`/employer/workforce/${selectedJob.id}`}>
                  {jobPlans[selectedJob.id] ? "Open plan →" : "Start planning →"}
                </Link>
              </div>

              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.5rem" }}>DESCRIPTION</p>
                <p style={{ fontSize: "0.85rem", color: "var(--ink-72)", lineHeight: 1.6 }}>{selectedJob.description}</p>
              </div>

              <div>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.5rem" }}>KEYWORDS</p>
                <div className="talent-pool-tags">
                  {selectedJob.keywords.map((keyword) => (
                    <span key={keyword}>{keyword}</span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--ink-06)", display: "flex", gap: "0.6rem" }}>
              <Link className="btn btn-ghost" href={`/employer/jobs/${selectedJob.id}/applicants`} style={{ flex: 1, justifyContent: "center" }}>
                View applicants
              </Link>
              <Link className="btn btn-primary" href={`/employer/jobs/${selectedJob.id}`} style={{ flex: 1, justifyContent: "center" }}>
                Full job page →
              </Link>
            </div>
          </div>
        )}
      </SideDrawer>
    </>
  );
}
