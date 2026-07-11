"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
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

  function toggleStatus(job: EmployerJob) {
    const status = job.status === "Active" ? "Draft" : "Active";
    setJobs((current) =>
      current.map((item) => (item.id === job.id ? { ...item, status } : item)),
    );
    employerApi.updateJob(job.id, { status }).catch((err) => {
      console.error("Failed to update job status:", err);
      setJobs((current) =>
        current.map((item) =>
          item.id === job.id ? { ...item, status: job.status } : item,
        ),
      );
    });
  }

  const activeCount = jobs.filter((job) => job.status === "Active").length;
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
          <b>{activeCount}</b>Active
        </span>
        <span>
          <b>{jobs.length - activeCount}</b>Draft
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
              <th>Status</th>
              <th>Applicants</th>
              <th>Interviews</th>
              <th>Mock interview</th>
              <th>Phase</th>
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
                  <button
                    className={`status-toggle ${job.status.toLowerCase()}`}
                    onClick={() => toggleStatus(job)}
                  >
                    <i />
                    {job.status}
                  </button>
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
                  <span className="chip">{job.pipeline_phase}</span>
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
