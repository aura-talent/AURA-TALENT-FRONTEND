"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { defaultPipelinePhases, isJobOpen, phaseMeta } from "@/app/employer/data";
import { currentPhaseProgress, getJobConfig } from "@/app/employer/pipelineConfig";
import HiringPipelineBoard from "@/components/employer/HiringPipelineBoard";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type EmployerJobPlan,
  type PhaseDef,
} from "@/lib/employerApi";

export default function JobsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [phases, setPhases] = useState<PhaseDef[]>(defaultPipelinePhases);
  const [plans, setPlans] = useState<EmployerJobPlan[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"pipeline" | "table">("pipeline");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.listJobs(),
      employerApi.getProfile(),
      employerApi.listJobPlans(),
      employerApi.listCandidates(),
    ])
      .then(([jobsRes, profileRes, plansRes, candidatesRes]) => {
        if (cancelled) return;
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        else console.error("Failed to load jobs:", jobsRes.reason);
        if (profileRes.status === "fulfilled" && profileRes.value.hiring_pipeline_phases?.length)
          setPhases(profileRes.value.hiring_pipeline_phases);
        if (plansRes.status === "fulfilled") setPlans(plansRes.value);
        if (candidatesRes.status === "fulfilled") setCandidates(candidatesRes.value);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const plansByJob = useMemo(
    () => Object.fromEntries(plans.map((plan) => [plan.job_id, plan])),
    [plans],
  );

  const metricNoun: Record<string, string> = {
    applicants: "applicants",
    evaluated: "evaluated",
    offers: "at offer",
    hires: "hired",
    manual: "",
  };

  async function toggleAutomation(job: EmployerJob) {
    const next = job.automation_level === "auto" ? "manual" : "auto";
    setJobs((current) =>
      current.map((j) => (j.id === job.id ? { ...j, automation_level: next } : j)),
    );
    try {
      await employerApi.updateJob(job.id, { automation_level: next });
    } catch (err) {
      console.error("Failed to update automation level:", err);
      setJobs((current) =>
        current.map((j) =>
          j.id === job.id ? { ...j, automation_level: job.automation_level } : j,
        ),
      );
    }
  }

  const openCount = jobs.filter(isJobOpen).length;
  const totalCandidates = jobs.reduce(
    (total, job) => total + (job.stats?.applicant_count ?? 0),
    0,
  );
  const totalInterviews = jobs.reduce(
    (total, job) => total + (job.stats?.interview_count ?? 0),
    0,
  );

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Content and distribution</p>
          <h1>Job listings</h1>
          <p>
            Create clear roles, configure scoring priorities, and track
            conversion from view to interview.
          </p>
        </div>
        <Link className="btn btn-primary" href="/employer/jobs/new">
          ＋ Create job
        </Link>
      </div>
      <div className="job-summary-strip">
        <span>
          <b>{openCount}</b>Open roles
        </span>
        <span>
          <b>{jobs.length}</b>Total jobs
        </span>
        <span>
          <b>{totalCandidates}</b>Total candidates
        </span>
        <span>
          <b>{totalInterviews}</b>Interviews
        </span>
      </div>
      {!loading && jobs.length > 0 && (
        <div className="candidate-view-tabs" role="tablist" aria-label="Job listing view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "pipeline"}
            className={view === "pipeline" ? "active" : ""}
            onClick={() => setView("pipeline")}
          >
            Hiring pipeline
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "table"}
            className={view === "table" ? "active" : ""}
            onClick={() => setView("table")}
          >
            All jobs
          </button>
        </div>
      )}
      {!loading && jobs.length > 0 && view === "pipeline" && (
        <section className="panel employer-section">
          <HiringPipelineBoard jobs={jobs} phases={phases} plans={plans} candidates={candidates} />
        </section>
      )}
      {(loading || view === "table" || jobs.length === 0) && (
      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading jobs…" />
        ) : (
        <table className="table employer-table jobs-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Applicants</th>
              <th>Interviews</th>
              <th>Mock interview</th>
              <th>Phase</th>
              <th>Automation</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <strong>{job.title}</strong>
                  <small>{job.team ?? "—"}</small>
                </td>
                <td>
                  <Link
                    className="table-action"
                    href={`/employer/jobs/${job.id}/applicants`}
                  >
                    {job.stats?.applicant_count ?? 0} view →
                  </Link>
                </td>
                <td>
                  <Link
                    className="table-action"
                    href={`/employer/jobs/${job.id}/applicants?activity=interview`}
                  >
                    {job.stats?.interview_count ?? 0} view →
                  </Link>
                </td>
                <td>
                  {job.mock_interview_enabled ? (
                    <span className="chip chip-tier-high">
                      {job.interview_questions.length} questions
                    </span>
                  ) : (
                    <span className="chip">Off</span>
                  )}
                </td>
                <td>
                  {(() => {
                    const meta = phaseMeta(job.pipeline_phase);
                    const config = getJobConfig(job, phases, plansByJob[job.id]?.openings ?? 1);
                    const progress = currentPhaseProgress(job, candidates, config);
                    return (
                      <div>
                        <span
                          className="chip"
                          style={{
                            background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                        {progress && !progress.isManualGate && (
                          <div style={{ marginTop: "0.4rem", minWidth: "120px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.65rem", color: "var(--ink-55)", marginBottom: "0.2rem" }}>
                              <span>
                                {progress.currentCount}/{progress.targetCount} {metricNoun[progress.metric]}
                              </span>
                            </div>
                            <div style={{ height: "4px", borderRadius: "999px", background: "var(--ink-06)", overflow: "hidden" }}>
                              <div
                                style={{
                                  width: `${progress.targetCount ? Math.min(100, Math.round((progress.currentCount / progress.targetCount) * 100)) : 0}%`,
                                  height: "100%",
                                  background: progress.met ? "#16a34a" : "var(--iris)",
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </td>
                <td>
                  <button
                    type="button"
                    className={`automation-toggle ${job.automation_level === "auto" ? "is-auto" : ""}`}
                    onClick={() => toggleAutomation(job)}
                    title={
                      job.automation_level === "auto"
                        ? "Aura is running this job automatically — click to switch to manual"
                        : "You're driving this job manually — click to let Aura automate it"
                    }
                  >
                    {job.automation_level === "auto" ? "⚡ Auto" : "Manual"}
                  </button>
                </td>
                <td>
                  <div className="job-row-actions">
                    <Link
                      className="job-detail-arrow"
                      href={`/employer/jobs/${job.id}`}
                      aria-label={`View ${job.title} details`}
                    >
                      →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
        {!loading && jobs.length === 0 && (
          <div className="empty-state">
            <h3>No jobs yet</h3>
            <p>Create your first job listing to start hiring.</p>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
