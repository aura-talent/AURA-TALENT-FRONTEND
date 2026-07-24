"use client";

import { useEffect, useState } from "react";
import {
  employerApi,
  timeAgo,
  type CommsMessage,
  type EmployerJob,
  type JobPhaseEvent,
} from "@/lib/employerApi";

/**
 * Job-level activity feed.
 *
 * Reads real events for the job — pipeline-phase moves (job_phase_events, with
 * their trigger: manual / auto / an agent name) and sent emails
 * (comms_messages) — most recent first. Empty until something happens on the
 * role; no more synthetic seeding.
 */
type Activity = { agent: string; color: string; text: string; when: string };

const TRIGGER_LABEL: Record<string, { agent: string; color: string }> = {
  manual: { agent: "Pipeline", color: "#64748b" },
  auto: { agent: "Aura Coordinator", color: "#7c3aed" },
  "hr-supervisor": { agent: "Aura HR", color: "#7c3aed" },
};

function phaseEventToActivity(e: JobPhaseEvent): Activity {
  const meta = TRIGGER_LABEL[e.trigger] ?? { agent: e.trigger, color: "#2563eb" };
  const from = e.from_phase ? `${e.from_phase} → ` : "";
  return {
    agent: meta.agent,
    color: meta.color,
    text: `Advanced ${from}${e.to_phase}`,
    when: timeAgo(e.created_at),
  };
}

function commsToActivity(m: CommsMessage): Activity {
  return {
    agent: "Aura Comms",
    color: "#0d9488",
    text:
      m.status === "failed"
        ? `Email failed: ${m.subject ?? "(no subject)"}`
        : `Email sent: ${m.subject ?? "(no subject)"}`,
    when: timeAgo(m.sent_at ?? m.created_at),
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
    ]).then(([phaseRes, commsRes]) => {
      if (cancelled) return;
      const events: { at: string; activity: Activity }[] = [];
      if (phaseRes.status === "fulfilled")
        for (const e of phaseRes.value)
          events.push({ at: e.created_at, activity: phaseEventToActivity(e) });
      if (commsRes.status === "fulfilled")
        for (const m of commsRes.value)
          events.push({ at: m.sent_at ?? m.created_at, activity: commsToActivity(m) });
      events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
      setFeed(events.map((e) => e.activity));
    });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  const list =
    feed === null ? (
      <p className="job-activity-note">Loading activity…</p>
    ) : feed.length === 0 ? (
      <p className="job-activity-note">
        No activity yet — phase moves and emails on this role will appear here.
      </p>
    ) : (
      <ol className="job-activity-feed">
        {feed.map((item, index) => (
          <li key={index}>
            <span className="job-activity-dot" style={{ background: item.color }} />
            <div>
              <strong style={{ color: item.color }}>{item.agent}</strong>
              <p>{item.text}</p>
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
    </section>
  );
}
