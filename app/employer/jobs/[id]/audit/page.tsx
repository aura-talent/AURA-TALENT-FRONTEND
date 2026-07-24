"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  employerApi,
  timeAgo,
  type EmployerJob,
  type JobPhaseEvent,
  type SuggestedAction,
} from "@/lib/employerApi";
import { agentLabel, COMPLETED_ANNOUNCEMENT_KINDS } from "@/lib/agentLabels";
import { Loader } from "@/components/ui/loader";

/**
 * Read-only history of everything the system decided on its own for this
 * job (0004): pipeline-phase moves + the completed-announcement suggestion
 * kinds (headhunter assigned, auto-shortlisted/rejected, plan drafted) that
 * JobActivityFeed deliberately excludes since they're facts about something
 * already done, not open activity to review.
 */
type Entry = { agent: string; color: string; text: string; note?: string | null; at: string };

function titleCase(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function phaseEventToEntry(e: JobPhaseEvent): Entry {
  const meta = agentLabel(e.trigger);
  const from = e.from_phase ? `${titleCase(e.from_phase)} → ` : "";
  return {
    agent: meta.label,
    color: meta.color,
    text: `Advanced ${from}${titleCase(e.to_phase)}`,
    note: e.note,
    at: e.created_at,
  };
}

function suggestionToEntry(a: SuggestedAction): Entry {
  const meta = agentLabel(a.agent);
  return {
    agent: meta.label,
    color: meta.color,
    text: a.title,
    note: a.body,
    at: a.created_at,
  };
}

export default function JobAuditTrailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.getJob(id),
      employerApi.phaseEvents(id),
      employerApi.listSuggestedActions("all"),
    ]).then(([jobRes, phaseRes, suggestionsRes]) => {
      if (cancelled) return;
      if (jobRes.status === "fulfilled") setJob(jobRes.value);
      const list: Entry[] = [];
      if (phaseRes.status === "fulfilled")
        for (const e of phaseRes.value) list.push(phaseEventToEntry(e));
      if (suggestionsRes.status === "fulfilled")
        for (const a of suggestionsRes.value)
          if (a.job_id === id && COMPLETED_ANNOUNCEMENT_KINDS.has(a.kind))
            list.push(suggestionToEntry(a));
      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setEntries(list);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Audit trail</p>
          <h1>{job?.title ?? "…"}</h1>
          <p>Every system-driven decision on this job — phase moves, auto-assignments, auto-shortlist/reject, and drafted plans — in one chronological log.</p>
        </div>
        <Link className="btn btn-ghost" href={`/employer/jobs/${id}`}>
          ← Back to job
        </Link>
      </div>
      <div className="panel candidate-table-wrap">
        {entries === null ? (
          <Loader label="Loading audit trail…" />
        ) : entries.length === 0 ? (
          <div className="empty-state">
            <h3>No history yet</h3>
            <p>Phase moves and system-driven actions on this job will appear here.</p>
          </div>
        ) : (
          <ol className="job-activity-feed">
            {entries.map((entry, index) => (
              <li key={index}>
                <span className="job-activity-dot" style={{ background: entry.color }} />
                <div>
                  <strong style={{ color: entry.color }}>{entry.agent}</strong>
                  <p>{entry.text}</p>
                  {entry.note && <small className="job-activity-detail">{entry.note}</small>}
                  <small>{timeAgo(entry.at)}</small>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
