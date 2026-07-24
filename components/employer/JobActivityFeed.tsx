"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { employerApi, type EmployerJob, type SuggestedAction } from "@/lib/employerApi";
import { deriveAgentActivity, type AgentActivityLine } from "@/lib/agentLabels";

/**
 * Job-level activity feed — a brief roster of which specialists are
 * currently (or, for standing behaviors like sourcing, about to at the
 * next scheduler sweep) working this role, one line per agent (0004
 * follow-up) rather than one line per candidate/suggestion. Completed
 * system transitions (phase moves, auto-assign, auto-shortlist, plan
 * drafts) and sent emails never appear here — they're one-shot facts, not
 * ongoing activity, and live in the Audit Trail page instead (linked
 * below). Per-candidate detail (who, what, waiting on your confirmation)
 * lives on the Applicants/Offers pages, which is also where the HIL red-dot
 * badges point.
 */
export default function JobActivityFeed({
  job,
  compact = false,
}: {
  job: EmployerJob;
  compact?: boolean;
}) {
  const [roster, setRoster] = useState<AgentActivityLine[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .listSuggestedActions("open")
      .then((suggestions: SuggestedAction[]) => {
        if (cancelled) return;
        setRoster(deriveAgentActivity(job, suggestions));
      })
      .catch(() => {
        if (!cancelled) setRoster([]);
      });
    return () => {
      cancelled = true;
    };
  }, [job]);

  const idleHint =
    job.automation_level === "auto" &&
    job.status === "Active" &&
    job.headhunter_ids.length === 0 &&
    (job.stats?.applicant_count ?? 0) === 0
      ? "Aura checks this job every minute — it'll auto-assign a headhunter and start sourcing shortly."
      : null;

  const list =
    roster === null ? (
      <p className="job-activity-note">Loading activity…</p>
    ) : roster.length === 0 ? (
      <p className="job-activity-note">
        No open activity right now — Aura&apos;s specialists will show up here once there&apos;s
        something to do on this role. Completed actions live in the audit trail.
      </p>
    ) : (
      <ol className="job-activity-feed">
        {roster.map((item) => (
          <li key={item.key}>
            <span className="job-activity-dot" style={{ background: item.color }} />
            <div>
              <strong style={{ color: item.color }}>{item.label}</strong>
              <p>
                {item.text}
                {item.count > 1 ? ` (${item.count})` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    );

  if (compact) {
    return (
      <div>
        <p style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-55)", marginBottom: "0.6rem", letterSpacing: "0.04em" }}>
          AGENT ACTIVITY
        </p>
        {list}
        {idleHint && <p className="job-activity-note job-activity-idle-hint">{idleHint}</p>}
      </div>
    );
  }

  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <p className="eyebrow">Agent activity</p>
          <h2>What Aura is doing</h2>
        </div>
        <Link className="table-action" href={`/employer/jobs/${job.id}/audit`}>
          View audit trail →
        </Link>
      </div>
      {list}
      {idleHint && <p className="job-activity-note job-activity-idle-hint">{idleHint}</p>}
    </section>
  );
}
