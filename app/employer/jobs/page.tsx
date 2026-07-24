"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { isJobOpen, phaseMeta } from "@/app/employer/data";
import { employerApi, type EmployerJob } from "@/lib/employerApi";

export default function JobsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .listJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => console.error("Failed to load jobs:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
    </div>
  );
}
