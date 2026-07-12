"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
} from "@/lib/employerApi";
import { Loader } from "@/components/ui/loader";

export default function InterviewsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listJobs(), employerApi.listCandidates()]).then(
      ([jobsRes, rowsRes]) => {
        if (cancelled) return;
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        if (rowsRes.status === "fulfilled") setRows(rowsRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const managedInterviews = jobs.filter(
    (job) => job.status === "Active" && job.mock_interview_enabled,
  );
  const attempted = (jobId: string) =>
    rows.filter(
      (row) => row.job_id === jobId && row.evaluation?.interview_evaluation,
    );
  const totalAttempts = rows.filter(
    (row) => row.evaluation?.interview_evaluation,
  ).length;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Interview management</p>
          <h1>Mock interviews</h1>
          <p>
            Manage every interview attached to an open role, review activity,
            and customize the candidate experience.
          </p>
        </div>
      </div>

      <div className="interview-management-summary">
        <article className="panel">
          <p>Active interviews</p>
          <strong>{managedInterviews.length}</strong>
          <span>Across open roles</span>
        </article>
        <article className="panel">
          <p>Total attempts</p>
          <strong>{totalAttempts}</strong>
          <span>Candidate submissions</span>
        </article>
        <article className="panel">
          <p>Roles with interviews</p>
          <strong>{jobs.filter((job) => job.mock_interview_enabled).length}</strong>
          <span>Mock interview enabled</span>
        </article>
      </div>

      {loading && (
        <div className="panel">
          <Loader label="Loading interviews…" />
        </div>
      )}

      <div className="interview-management-grid">
        {!loading && managedInterviews.map((job) => {
          const roleRows = rows.filter((row) => row.job_id === job.id);
          const attemptCount = attempted(job.id).length;

          return (
            <article className="panel interview-management-card" key={job.id}>
              <header>
                <div className="job-company-mark">
                  {job.title.slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <span>{job.team ?? "—"}</span>
                  <small>Active role</small>
                </div>
                <span className="chip chip-tier-high">Live</span>
              </header>

              <h2>{job.title}</h2>
              <p>
                {job.interview_questions.length} adaptive questions · video,
                voice, or text response
              </p>

              <div className="interview-card-stats">
                <span>
                  <strong>{attemptCount}</strong>
                  Attempts
                </span>
                <span>
                  <strong>{roleRows.length}</strong>
                  Candidates
                </span>
                <span>
                  <strong>{job.stats?.interview_count ?? 0}</strong>
                  Evaluated
                </span>
              </div>

              <footer>
                <Link
                  href={`/employer/jobs/${job.id}/applicants`}
                  className="btn btn-ghost"
                >
                  View candidates
                </Link>
                <Link
                  href={`/employer/interviews/${job.id}/customize`}
                  className="btn btn-primary"
                >
                  Customize
                </Link>
              </footer>
            </article>
          );
        })}
        {!loading && managedInterviews.length === 0 && (
          <div className="empty-state panel">
            <h3>No active mock interviews</h3>
            <p>Enable a mock interview on an active job to manage it here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
