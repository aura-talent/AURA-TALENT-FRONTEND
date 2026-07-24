"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { employerApi, timeAgo, type EmployerJob, type SuggestedAction } from "@/lib/employerApi";
import { agentLabel } from "@/lib/agentLabels";
import { Loader } from "@/components/ui/loader";

/**
 * Cross-job applicant queue (0004 follow-up) — every open suggestion that
 * needs employer attention (unscored applicants, interview invites,
 * follow-ups, flagged reviews), grouped by role. This is what the
 * Applicants nav badge points at; previously the badge counted real items
 * but the page itself was a stub.
 */
const APPLICANT_KINDS = new Set(["score_candidate", "flag_review", "send_interview_invite", "follow_up"]);
const EXECUTABLE_KINDS = new Set(["score_candidate", "send_interview_invite", "follow_up"]);

const ACTION_LABEL: Record<string, string> = {
  score_candidate: "Score now",
  send_interview_invite: "Send invite",
  follow_up: "Send follow-up",
};

function candidateIdFor(a: SuggestedAction): string | null {
  const fromPayload = (a.payload as { candidate_user_id?: string } | null)?.candidate_user_id;
  return fromPayload ?? a.candidate_user_id ?? null;
}

export default function ApplicantsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listJobs(), employerApi.listSuggestedActions("open")]).then(
      ([jobsRes, actionsRes]) => {
        if (cancelled) return;
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        if (actionsRes.status === "fulfilled") setActions(actionsRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const groups = useMemo(() => {
    const relevant = actions.filter((a) => APPLICANT_KINDS.has(a.kind) && a.job_id);
    const byJob = new Map<string, SuggestedAction[]>();
    for (const a of relevant) {
      const list = byJob.get(a.job_id as string) ?? [];
      list.push(a);
      byJob.set(a.job_id as string, list);
    }
    return Array.from(byJob.entries())
      .map(([jobId, items]) => ({ job: jobsById.get(jobId), jobId, items }))
      .filter((g): g is { job: EmployerJob; jobId: string; items: SuggestedAction[] } => Boolean(g.job))
      .sort((a, b) => b.items.length - a.items.length);
  }, [actions, jobsById]);

  const total = groups.reduce((sum, g) => sum + g.items.length, 0);

  async function runAction(action: SuggestedAction) {
    setRunningId(action.id);
    setError(null);
    try {
      await employerApi.executeSuggestedAction(action.id);
      setActions((current) => current.filter((a) => a.id !== action.id));
    } catch {
      setError("Couldn't complete that action — try again.");
    } finally {
      setRunningId(null);
    }
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Jobs · Action</p>
          <h1>Applicants</h1>
          <p>Everything Aura needs your review or confirmation on, across every role.</p>
        </div>
        {!loading && <span className="chip chip-tier-high">{total} pending</span>}
      </div>

      {error && (
        <p style={{ color: "var(--danger, #dc2626)", fontSize: "0.8rem", margin: "-0.5rem 0 1rem" }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="panel">
          <Loader label="Loading applicants…" />
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state panel">
          <h3>Nothing needs your attention</h3>
          <p>
            Unscored applicants, interview invites, and follow-ups will show up here as Aura
            works through each role&apos;s pipeline. Browse everyone from{" "}
            <Link href="/employer/jobs">Job Listing</Link> instead.
          </p>
        </div>
      ) : (
        groups.map(({ job, jobId, items }) => (
          <section key={jobId} className="panel candidate-table-wrap" style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                marginBottom: "0.9rem",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>
                  <Link href={`/employer/jobs/${jobId}`}>{job.title}</Link>
                </h2>
                <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--ink-55)" }}>
                  {job.team ?? "—"} · {job.location ?? "—"}
                </p>
              </div>
              <span className="chip">{items.length} pending</span>
            </div>
            <div className="suggested-actions-list">
              {items.map((a) => {
                const meta = agentLabel(a.agent);
                const candidateId = candidateIdFor(a);
                const executable = EXECUTABLE_KINDS.has(a.kind);
                return (
                  <div className="suggested-action-card panel" key={a.id}>
                    <span className="suggested-action-badge" style={{ background: `color-mix(in srgb, ${meta.color} 16%, transparent)`, color: meta.color }}>
                      {meta.label.split(" ")[0]}
                    </span>
                    <div className="suggested-action-body">
                      <strong>
                        {candidateId ? (
                          <Link href={`/employer/candidates/${candidateId}`}>{a.title}</Link>
                        ) : (
                          a.title
                        )}
                      </strong>
                      {a.body && <p>{a.body}</p>}
                      <small style={{ display: "block", marginTop: "0.2rem", color: "var(--ink-55)" }}>
                        {meta.label} · {timeAgo(a.created_at)}
                      </small>
                    </div>
                    <div className="suggested-action-controls">
                      {executable ? (
                        <button
                          className="btn btn-ghost"
                          disabled={runningId === a.id}
                          onClick={() => runAction(a)}
                        >
                          {runningId === a.id ? "Working…" : ACTION_LABEL[a.kind]}
                        </button>
                      ) : candidateId ? (
                        <Link className="btn btn-ghost" href={`/employer/candidates/${candidateId}`}>
                          Review
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
