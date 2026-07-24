"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  candidateInitials,
  employerApi,
  type CandidateRow,
  type EmployerJob,
} from "@/lib/employerApi";
import { Loader } from "@/components/ui/loader";

export default function JobApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const { id } = use(params);
  const { activity } = use(searchParams);
  const interviewOnly = activity === "interview";

  const [job, setJob] = useState<EmployerJob | null>(null);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState<Set<string>>(new Set());
  const [queued, setQueued] = useState<Set<string>>(new Set());
  const [togglingSelect, setTogglingSelect] = useState<Set<string>>(new Set());

  async function toggleSelectForOffer(row: CandidateRow) {
    if (!row.application) return;
    const applicationId = row.application.id;
    const next = !row.application.selected_for_offer;
    setTogglingSelect((s) => new Set(s).add(applicationId));
    try {
      const updated = await employerApi.selectForOffer(applicationId, next);
      setRows((rs) =>
        rs.map((r) =>
          r.candidate_user_id === row.candidate_user_id ? { ...r, application: updated } : r,
        ),
      );
    } catch (err) {
      console.error("Failed to toggle select-for-offer:", err);
    } finally {
      setTogglingSelect((s) => {
        const next = new Set(s);
        next.delete(applicationId);
        return next;
      });
    }
  }

  async function scoreNow(candidateUserId: string) {
    setScoring((s) => new Set(s).add(candidateUserId));
    try {
      await employerApi.triggerEvaluation(id, candidateUserId, "aura");
      setQueued((q) => new Set(q).add(candidateUserId));
    } catch (err) {
      console.error("Failed to trigger evaluation:", err);
    } finally {
      setScoring((s) => {
        const next = new Set(s);
        next.delete(candidateUserId);
        return next;
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.getJob(id),
      employerApi.listCandidates(id),
    ]).then(([jobRes, rowsRes]) => {
      if (cancelled) return;
      if (jobRes.status === "fulfilled") setJob(jobRes.value);
      if (rowsRes.status === "fulfilled") setRows(rowsRes.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading)
    return (
      <div className="employer-page">
        <Loader label="Loading applicants…" />
      </div>
    );
  if (!job)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Job not found</h3>
        </div>
      </div>
    );

  const interviewAttempted = (row: CandidateRow) =>
    Boolean(row.evaluation?.interview_evaluation || row.evaluation?.interview_score != null);
  const allPeople = rows.filter((row) => row.application || interviewAttempted(row));
  const people = interviewOnly ? allPeople.filter(interviewAttempted) : allPeople;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {interviewOnly
              ? "Mock interview attempts"
              : "Applicants and interview attempts"}
          </p>
          <h1>{job?.title ?? "…"}</h1>
          <p>
            {interviewOnly
              ? "Review candidates who attempted this role's mock interview and open their interview evaluation."
              : "Review candidates who applied, attempted the mock interview, or completed both paths."}
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/employer/jobs/${id}/edit`}>
          Edit job setup
        </Link>
      </div>
      <div className="candidate-view-tabs" aria-label="Candidate activity view">
        <Link
          className={!interviewOnly ? "active" : ""}
          href={`/employer/jobs/${id}/applicants`}
        >
          All activity
        </Link>
        <Link
          className={interviewOnly ? "active" : ""}
          href={`/employer/jobs/${id}/applicants?activity=interview`}
        >
          Interview attempts
        </Link>
      </div>
      <div className="applicant-summary">
        <span>
          <strong>{allPeople.filter((row) => row.application).length}</strong>
          Applied
        </span>
        <span>
          <strong>{allPeople.filter(interviewAttempted).length}</strong>
          Interview attempted
        </span>
        <span>
          <strong>
            {allPeople.filter((row) => row.application && interviewAttempted(row)).length}
          </strong>
          Completed both
        </span>
      </div>
      <div className="panel candidate-table-wrap">
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Participation</th>
              <th>Application</th>
              <th>Interview</th>
              <th>Current score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((row) => {
              const score = row.evaluation?.wlc_score;
              return (
                <tr key={row.candidate_user_id}>
                  <td>
                    <div className="candidate-cell">
                      <span className="candidate-avatar">
                        {candidateInitials(row.full_name)}
                      </span>
                      <div>
                        <strong>{row.full_name ?? row.email ?? "Candidate"}</strong>
                        <small>{row.email}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="candidate-activity">
                      {row.application && (
                        <span className="chip chip-tier-high">Applied</span>
                      )}
                      {interviewAttempted(row) && (
                        <span className="chip">Interview attempted</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {row.application ? (
                      <span className="completion-check">{row.application.stage}</span>
                    ) : (
                      <span className="signal-missing">Not applied</span>
                    )}
                  </td>
                  <td>
                    {interviewAttempted(row) ? (
                      <Link
                        className="completion-check"
                        href={`/employer/candidates/${row.candidate_user_id}/interview`}
                      >
                        {Math.round(row.evaluation?.interview_score ?? 0)}/100
                      </Link>
                    ) : (
                      <span className="signal-missing">Optional · pending</span>
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
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
                      {!interviewOnly && row.application && (
                        <button
                          className={row.application.selected_for_offer ? "btn btn-primary" : "btn btn-ghost"}
                          disabled={togglingSelect.has(row.application.id)}
                          onClick={() => toggleSelectForOffer(row)}
                          title="Manually select or unselect this candidate for the Offer Console"
                        >
                          {row.application.selected_for_offer ? "★ Selected" : "☆ Select for offer"}
                        </button>
                      )}
                      {!interviewOnly && (
                        <button
                          className="btn btn-ghost"
                          disabled={scoring.has(row.candidate_user_id) || queued.has(row.candidate_user_id)}
                          onClick={() => scoreNow(row.candidate_user_id)}
                          title="Run the evaluation agent for this candidate"
                        >
                          {scoring.has(row.candidate_user_id)
                            ? "Scoring…"
                            : queued.has(row.candidate_user_id)
                              ? "Queued ✓"
                              : score != null
                                ? "Re-score"
                                : "Score now"}
                        </button>
                      )}
                      <Link
                        href={
                          interviewOnly
                            ? `/employer/candidates/${row.candidate_user_id}/interview`
                            : `/employer/candidates/${row.candidate_user_id}`
                        }
                        className="table-action"
                      >
                        {interviewOnly ? "View interview →" : "Evaluate →"}
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!loading && people.length === 0 && (
          <div className="empty-state">
            <h3>No activity yet</h3>
            <p>
              {interviewOnly
                ? "Completed mock interview attempts will appear here."
                : "Applicants and mock interview attempts will appear here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
