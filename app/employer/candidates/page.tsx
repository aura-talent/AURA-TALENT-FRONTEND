"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  candidateInitials,
  employerApi,
  type CandidateRow,
  type EmployerJob,
} from "@/lib/employerApi";
import StageChip from "@/components/employer/StageChip";
import { Loader } from "@/components/ui/loader";

export default function CandidatesPage() {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All stages");
  const [activity, setActivity] = useState("All activity");
  const [jobFilter, setJobFilter] = useState("All roles");

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listCandidates(), employerApi.listJobs()]).then(
      ([rowsRes, jobsRes]) => {
        if (cancelled) return;
        if (rowsRes.status === "fulfilled") setRows(rowsRes.value);
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const stageOptions = useMemo(
    () => [...new Set(rows.map((row) => row.application?.stage).filter(Boolean))] as string[],
    [rows],
  );

  const interviewAttempted = (row: CandidateRow) =>
    Boolean(row.evaluation?.interview_evaluation || row.evaluation?.interview_score != null);

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        const matchesQuery = `${row.full_name ?? ""} ${row.email ?? ""} ${row.job_title}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const applied = Boolean(row.application);
        const matchesActivity =
          activity === "All activity" ||
          (activity === "Applied" && applied) ||
          (activity === "Interview attempted" && interviewAttempted(row)) ||
          (activity === "Both" && applied && interviewAttempted(row));
        const matchesJob = jobFilter === "All roles" || row.job_id === jobFilter;
        return (
          matchesQuery &&
          matchesActivity &&
          matchesJob &&
          (stage === "All stages" || row.application?.stage === stage)
        );
      }),
    [rows, query, stage, activity, jobFilter],
  );

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent pipeline</p>
          <h1>Candidates</h1>
          <p>
            One scorecard for resume strength, skills, preferences, and
            interview performance.
          </p>
        </div>
        <Link href="/employer/talent-pool" className="btn btn-primary">
          Browse talent pool
        </Link>
      </div>
      <div className="candidate-toolbar panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidates or roles"
            aria-label="Search candidates"
          />
        </label>
        <select
          className="select"
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          <option>All stages</option>
          {stageOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select
          className="select"
          value={activity}
          onChange={(event) => setActivity(event.target.value)}
        >
          <option>All activity</option>
          <option>Applied</option>
          <option>Interview attempted</option>
          <option>Both</option>
        </select>
        <select
          className="select"
          aria-label="Filter by role"
          value={jobFilter}
          onChange={(event) => setJobFilter(event.target.value)}
        >
          <option value="All roles">All roles</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        <span className="candidate-result-count">
          {filtered.length} candidates
        </span>
      </div>
      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading candidates…" />
        ) : (
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Activity</th>
              <th>Stage</th>
              <th>Resume</th>
              <th>Interview</th>
              <th>Overall match</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => {
              const score = row.evaluation?.wlc_score;
              return (
                <tr key={`${row.job_id}-${row.candidate_user_id}`}>
                  <td>
                    <div className="candidate-cell">
                      <span className="candidate-avatar">
                        {candidateInitials(row.full_name)}
                      </span>
                      <div>
                        <strong>{row.full_name ?? row.email ?? "Candidate"}</strong>
                        <small>{row.job_title}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="candidate-activity">
                      {row.application && (
                        <span className="chip chip-tier-high">Applied</span>
                      )}
                      {interviewAttempted(row) && (
                        <span className="chip">Interview</span>
                      )}
                      {!row.application && !interviewAttempted(row) && (
                        <span className="chip">Profile match</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {row.application ? (
                      <StageChip
                        stage={row.application.stage}
                        stages={row.job_application_stages}
                      />
                    ) : (
                      <span className="signal-missing">—</span>
                    )}
                  </td>
                  <td>
                    {row.evaluation?.resume_score != null ? (
                      <span className="signal-score">
                        {Math.round(row.evaluation.resume_score)}
                      </span>
                    ) : (
                      <span className="signal-missing">Not scored</span>
                    )}
                  </td>
                  <td>
                    {row.evaluation?.interview_score != null ? (
                      <span className="signal-score">
                        {Math.round(row.evaluation.interview_score)}
                      </span>
                    ) : (
                      <span className="signal-missing">Not attempted</span>
                    )}
                  </td>
                  <td>
                    <div className="match-cell">
                      <b>{score != null ? `${Math.round(score)}%` : "—"}</b>
                      <span>
                        <i style={{ width: `${score ?? 0}%` }} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <Link
                      href={`/employer/candidates/${row.candidate_user_id}`}
                      className="table-action"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="empty-state">
            <h3>No candidates found</h3>
            <p>Try a broader search or another pipeline stage.</p>
          </div>
        )}
      </div>
    </div>
  );
}
