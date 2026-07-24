"use client";

import { useEffect, useState } from "react";
import {
  employerApi,
  timeAgo,
  type CommsMessage,
  type EmployerJob,
  type JobPhaseEvent,
  type SuggestedAction,
} from "@/lib/employerApi";

/**
 * Job-level activity feed.
 *
 * Reads real events for the job — pipeline-phase moves (job_phase_events),
 * sent emails (comms_messages), and agent-drafted suggestions
 * (suggested_actions, any status) — most recent first. Empty until
 * something happens on the role; no more synthetic seeding.
 */
type Activity = { agent: string; color: string; text: string; note?: string | null; when: string };

function titleCase(s: string) {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Every trigger/source string the backend actually writes (see
// job_phase_events.trigger and suggested_actions.source). Unknown future
// values fall back to a title-cased version of the raw string rather than
// showing it verbatim.
const TRIGGER_LABEL: Record<string, { agent: string; color: string }> = {
  manual: { agent: "You", color: "#64748b" },
  auto: { agent: "Auto-advance", color: "#2563eb" },
  "hr-supervisor": { agent: "Hiring Agent", color: "#7c3aed" },
  "chat-agent": { agent: "Hiring Agent", color: "#7c3aed" },
};

const SEND_KINDS = new Set(["send_interview_invite", "follow_up", "recommend_offer"]);

function phaseEventToActivity(e: JobPhaseEvent): Activity {
  const meta = TRIGGER_LABEL[e.trigger] ?? { agent: titleCase(e.trigger), color: "#2563eb" };
  const from = e.from_phase ? `${titleCase(e.from_phase)} → ` : "";
  return {
    agent: meta.agent,
    color: meta.color,
    text: `Advanced ${from}${titleCase(e.to_phase)}`,
    note: e.note,
    when: timeAgo(e.created_at),
  };
}

function commsToActivity(m: CommsMessage): Activity {
  return {
    agent: "Hiring Agent",
    color: "#0d9488",
    text:
      m.status === "failed"
        ? `Email failed: ${m.subject ?? "(no subject)"}`
        : `Email sent: ${m.subject ?? "(no subject)"}`,
    when: timeAgo(m.sent_at ?? m.created_at),
  };
}

function suggestionToActivity(a: SuggestedAction): Activity {
  const needsConfirmation = SEND_KINDS.has(a.kind);
  const statusNote =
    a.status === "done"
      ? "Confirmed and sent"
      : a.status === "dismissed"
        ? "Dismissed"
        : "Waiting for your confirmation";
  return {
    agent: "Hiring Agent",
    color: "#7c3aed",
    text: a.title,
    note: needsConfirmation ? statusNote : a.body,
    when: timeAgo(a.created_at),
  };
}

export default function JobActivityFeed({
  job,
  compact = false,
}: {
  job: EmployerJob;
  compact?: boolean;
}) {
  const [feed, setFeed] = useState<Activity[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.phaseEvents(job.id),
      employerApi.listComms({ jobId: job.id }),
      employerApi.listSuggestedActions("all"),
    ]).then(([phaseRes, commsRes, suggestionsRes]) => {
      if (cancelled) return;
      const events: { at: string; activity: Activity }[] = [];
      if (phaseRes.status === "fulfilled")
        for (const e of phaseRes.value)
          events.push({ at: e.created_at, activity: phaseEventToActivity(e) });
      if (commsRes.status === "fulfilled")
        for (const m of commsRes.value)
          events.push({ at: m.sent_at ?? m.created_at, activity: commsToActivity(m) });
      if (suggestionsRes.status === "fulfilled")
        for (const a of suggestionsRes.value)
          if (a.job_id === job.id)
            events.push({ at: a.created_at, activity: suggestionToActivity(a) });
      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setFeed(events.map((e) => e.activity));
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const idleHint =
    job.automation_level === "auto" &&
    job.status === "Active" &&
    job.headhunter_ids.length === 0 &&
    (job.stats?.applicant_count ?? 0) === 0
      ? "Aura checks this job every few minutes — it'll auto-assign a headhunter and start sourcing shortly."
      : null;

  const list =
    feed === null ? (
      <p className="job-activity-note">Loading activity…</p>
    ) : feed.length === 0 ? (
      <p className="job-activity-note">
        No activity yet — phase moves, sourcing, and emails on this role will appear here.
      </p>
    ) : (
      <ol className="job-activity-feed">
        {feed.map((item, index) => (
          <li key={index}>
            <span className="job-activity-dot" style={{ background: item.color }} />
            <div>
              <strong style={{ color: item.color }}>{item.agent}</strong>
              <p>{item.text}</p>
              {item.note && <small className="job-activity-detail">{item.note}</small>}
              <small>{item.when}</small>
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
      </div>
      {list}
      {idleHint && <p className="job-activity-note job-activity-idle-hint">{idleHint}</p>}
    </section>
  );
}
