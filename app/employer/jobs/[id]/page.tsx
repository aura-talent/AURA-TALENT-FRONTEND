"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { setBreadcrumbLabel } from "@/components/employer/Breadcrumbs";
import JobActivityFeed from "@/components/employer/JobActivityFeed";
import { headhunterInitials, phaseMeta, planStatusChipClass } from "@/app/employer/data";
import {
  candidateInitials,
  employerApi,
  formatSalary,
  timeAgo,
  type CandidateRow,
  type EmployerHeadhunter,
  type EmployerJob,
  type EmployerJobPlan,
} from "@/lib/employerApi";

function recommendationScore(row: CandidateRow, job: EmployerJob) {
  const evidence = new Set(
    (row.evaluation?.matched_keywords ?? []).map((value) => value.toLowerCase()),
  );
  const matches = job.keywords.filter((keyword) =>
    evidence.has(keyword.toLowerCase()),
  );
  const skillScore = job.keywords.length
    ? Math.round((matches.length / job.keywords.length) * 100)
    : 0;
  const base = row.evaluation?.wlc_score ?? 50;
  const overall = Math.round(base * 0.65 + skillScore * 0.35);
  return { matches, overall };
}

export default function EmployerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [plan, setPlan] = useState<EmployerJobPlan | null>(null);
  const [headhunters, setHeadhunters] = useState<EmployerHeadhunter[]>([]);
  const [candidateRows, setCandidateRows] = useState<CandidateRow[]>([]);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.getJob(id),
      employerApi.getJobPlan(id),
      employerApi.listHeadhunters(),
      employerApi.listCandidates(),
    ]).then(([jobRes, planRes, hhRes, candidatesRes]) => {
      if (cancelled) return;
      if (jobRes.status === "fulfilled") setJob(jobRes.value);
      else setNotFound(true);
      if (planRes.status === "fulfilled") setPlan(planRes.value);
      if (hhRes.status === "fulfilled") setHeadhunters(hhRes.value);
      if (candidatesRes.status === "fulfilled") setCandidateRows(candidatesRes.value);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (job) setBreadcrumbLabel(id, job.title);
  }, [id, job]);

  async function closeJob() {
    if (!job) return;
    const previous = job.pipeline_phase;
    setJob({ ...job, pipeline_phase: "closed" });
    try {
      await employerApi.updateJob(job.id, { pipeline_phase: "closed" });
    } catch (err) {
      console.error("Failed to close job:", err);
      setJob({ ...job, pipeline_phase: previous });
    }
  }

  if (notFound)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Job not found</h3>
        </div>
      </div>
    );
  if (!job)
    return (
      <div className="employer-page">
        <Loader label="Loading job…" />
      </div>
    );

  const assignedHeadhunters = headhunters.filter((headhunter) =>
    job.headhunter_ids.includes(headhunter.id),
  );

  const recommendations = candidateRows
    .filter((row) => row.job_id !== job.id && row.evaluation)
    .map((row) => ({ row, ...recommendationScore(row, job) }))
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 5);

  return (
    <div className="employer-page">
      <div className="employer-job-detail-head panel">
        <div>
          <div className="employer-job-detail-meta">
            {(() => {
              const meta = phaseMeta(job.pipeline_phase);
              return (
                <span
                  className="chip"
                  style={{
                    background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </span>
              );
            })()}
            <span>{job.team ?? "—"}</span>
            <span>Created {timeAgo(job.created_at)}</span>
          </div>
          <h1>{job.title}</h1>
          <p>{job.description}</p>
        </div>
        <div className="employer-job-detail-actions">
          <Link className="btn btn-ghost" href={`/employer/jobs/${job.id}/applicants`}>
            View applicants
          </Link>
          <Link className="btn btn-ghost" href={`/employer/jobs/${job.id}/stages`}>
            Configure stages
          </Link>
          <Link className="btn btn-primary" href={`/employer/jobs/${job.id}/edit`}>
            Edit job
          </Link>
          {job.pipeline_phase !== "closed" && (
            <button className="btn btn-ghost" style={{ color: "#dc2626" }} onClick={closeJob}>
              Close job
            </button>
          )}
        </div>
      </div>

      <div className="employer-job-facts">
        <article className="panel"><span>Location</span><strong>{job.location ?? "—"}</strong></article>
        <article className="panel"><span>Employment</span><strong>{job.employment_type ?? "—"}</strong></article>
        <article className="panel"><span>Compensation</span><strong>{formatSalary(job)}</strong></article>
        <article className="panel"><span>Applicants</span><strong>{job.stats?.applicant_count ?? 0}</strong></article>
      </div>

      <div className="employer-job-detail-grid">
        <main>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Role configuration</p>
                <h2>Priority evidence</h2>
                <p>Skills and signals used to evaluate new and previous candidates.</p>
              </div>
            </div>
            <div className="job-match-evidence">
              {job.keywords.map((keyword, index) => (
                <span key={keyword}><i>{index < 3 ? "Priority" : "Matched"}</i>{keyword}</span>
              ))}
            </div>
          </section>

          <section className="panel employer-section talent-recommendations">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Aura talent recall</p>
                <h2>Recommended from your talent pool</h2>
                <p>Candidates evaluated for your other roles who may fit this one.</p>
              </div>
              <Link href="/employer/talent-pool">View talent pool →</Link>
            </div>
            <div className="talent-recommendation-list">
              {recommendations.map(({ row, matches, overall }) => (
                <article key={`${row.job_id}-${row.candidate_user_id}`}>
                  <span className="candidate-avatar">{candidateInitials(row.full_name)}</span>
                  <div>
                    <header>
                      <div>
                        <strong>{row.full_name ?? row.email ?? "Candidate"}</strong>
                        <small>
                          {row.application ? `${row.application.stage} · ` : ""}
                          {row.job_title}
                        </small>
                      </div>
                      <span className="quality-score">{overall}% renewed fit</span>
                    </header>
                    <p>
                      {matches.length
                        ? `Aura found prior evidence for ${matches.join(", ")}.`
                        : `Aura sees transferable evidence and recommends a human review.`}
                    </p>
                    <footer>
                      <span>{row.evaluation?.match_summary?.slice(0, 60) ?? row.job_title}</span>
                      <Link href={`/employer/candidates/${row.candidate_user_id}`}>Review and reconnect →</Link>
                    </footer>
                  </div>
                </article>
              ))}
              {recommendations.length === 0 && (
                <p style={{ color: "var(--ink-55)", fontSize: "0.85rem" }}>
                  No evaluated candidates from other roles yet.
                </p>
              )}
            </div>
          </section>
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">Hiring activity</p>
            <div className="job-detail-stats-row">
              <div className="job-detail-stat"><strong>{job.stats?.applicant_count ?? 0}</strong><span>Candidates</span></div>
              <div className="job-detail-stat"><strong>{job.stats?.interview_count ?? 0}</strong><span>Interviews</span></div>
              <div className="job-detail-stat"><strong>{job.interview_questions.length}</strong><span>Questions</span></div>
            </div>
          </section>
          <JobActivityFeed job={job} />
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Planning</p>
                <h2>Workforce plan</h2>
              </div>
              <Link href={`/employer/workforce/${job.id}`}>
                {plan ? "Open plan →" : "Start planning →"}
              </Link>
            </div>
            {plan ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.8rem" }}>
                  <span className={`chip ${planStatusChipClass(plan.status)}`}>
                    {plan.status}
                  </span>
                  <span className="chip">{plan.priority ?? "—"} priority</span>
                </div>
                <div className="job-detail-stat"><strong>{plan.openings}</strong><span>Planned openings</span></div>
                <div className="job-detail-stat"><strong>RM {((plan.budget ?? 0) / 1000).toFixed(0)}k</strong><span>Annual budget</span></div>
                <div className="job-detail-stat"><strong>{plan.target_fill_date || "TBD"}</strong><span>Target fill date</span></div>
              </>
            ) : (
              <p style={{ color: "var(--ink-55)", fontSize: "0.82rem" }}>
                No workforce plan yet. Start one to set headcount, budget, and
                target dates for this role.
              </p>
            )}
          </section>

          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Sourcing</p>
                <h2>Headhunters on this job</h2>
              </div>
              <Link href="/employer/headhunters">Manage →</Link>
            </div>
            {assignedHeadhunters.length === 0 ? (
              <p style={{ color: "var(--ink-55)", fontSize: "0.82rem" }}>
                No headhunter assigned yet. Add one from the job editor.
              </p>
            ) : (
              <div className="candidate-compact-list">
                {assignedHeadhunters.map((headhunter) => (
                  <Link
                    key={headhunter.id}
                    href={`/employer/headhunters/${headhunter.id}/edit`}
                  >
                    <span className="candidate-avatar">{headhunterInitials(headhunter.name)}</span>
                    <div>
                      <strong>{headhunter.name}</strong>
                      <p>{headhunter.stats.candidates_sourced ?? 0} sourced</p>
                    </div>
                    <span className="chip chip-tier-high">{headhunter.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </section>
          <section className="panel employer-section talent-recall-note">
            <span className="attention-icon">✦</span>
            <h3>Why talent recall matters</h3>
            <p>These candidates already invested in your hiring process. Re-engagement starts with context and a warmer conversation.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
