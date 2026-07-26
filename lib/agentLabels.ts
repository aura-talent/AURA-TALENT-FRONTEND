/** Shared specialist label map (0004) — one source of truth for how each
 * agent/trigger renders across JobActivityFeed and the Audit Trail page, so
 * "Hiring Agent" stops being the label for literally everything. Keys match
 * suggested_actions.agent and job_phase_events.trigger values written by the
 * backend (see app/employer/graphs/*.py). */
export const AGENT_LABEL: Record<string, { label: string; color: string }> = {
  "candidate-management": { label: "🧠 Hiring Agent", color: "#7c3aed" },
  "headhunter-sourcing": { label: "🔍 Headhunters", color: "#0d9488" },
  evaluation: { label: "📊 Evaluation Agent", color: "#c026d3" },
  planning: { label: "📋 Planning Agent", color: "#2563eb" },
  communication: { label: "📨 Communication Agent", color: "#d97706" },
  "hr-supervisor": { label: "⚙️ Auto-advance", color: "#64748b" },
  "chat-agent": { label: "💬 Aura Chat", color: "#7c3aed" },
  manual: { label: "You", color: "#64748b" },
  auto: { label: "⚙️ Auto-advance", color: "#2563eb" },
};

const FALLBACK = { label: "System", color: "#64748b" };

export function agentLabel(key: string | null | undefined): { label: string; color: string } {
  if (!key) return FALLBACK;
  return AGENT_LABEL[key] ?? { label: key.replace(/[-_]/g, " "), color: "#64748b" };
}

/** One-shot "X already happened" suggestion kinds — completed system
 * transitions, not open asks. Excluded from the live Activity Feed (0004)
 * and merged into the Audit Trail instead. */
export const COMPLETED_ANNOUNCEMENT_KINDS = new Set([
  "headhunter_assigned",
  "phase_advanced",
  "sourcing_run",
  "candidate_shortlisted",
  "candidate_auto_rejected",
  "plan_drafted",
]);

/** Present-continuous phrase for an OPEN suggestion, keyed by
 * `agent:kind` — this is what turns raw suggestion rows into the
 * "🔍 Headhunters are sourcing candidates" style one-liners the Activity
 * Feed roster shows (0004 follow-up). Falls back to a generic phrase per
 * agent when the exact kind isn't mapped. */
const OPEN_KIND_PHRASE: Record<string, Record<string, string>> = {
  communication: {
    send_interview_invite: "is drafting an interview invitation",
    follow_up: "is drafting a follow-up email",
    recommend_offer: "is drafting an offer email",
  },
  "candidate-management": {
    score_candidate: "is evaluating applicants",
    send_interview_invite: "is proposing interview invites",
    follow_up: "is proposing candidate follow-ups",
    recommend_offer: "is proposing offer candidates",
    flag_review: "flagged applicants for your review",
  },
};

const OPEN_KIND_FALLBACK: Record<string, string> = {
  communication: "is drafting candidate communication",
  "candidate-management": "is working the candidate pipeline",
};

export function agentActivityPhrase(agent: string, kind: string): string {
  return (
    OPEN_KIND_PHRASE[agent]?.[kind] ??
    OPEN_KIND_FALLBACK[agent] ??
    "is working on this role"
  );
}

export type AgentActivityLine = {
  key: string;
  label: string;
  color: string;
  text: string;
  count: number;
};

/** Roster of "who's doing what" for a job's Activity Feed — one brief line
 * per agent, not one per candidate/suggestion (0004 follow-up: "list out
 * all agents who are working in brief", matching the spec's own examples:
 * "🔍 Headhunters are sourcing candidates", "🧠 Hiring Agent is evaluating
 * applicants"). Headhunter sourcing has no suggestion row to key off (it's
 * a standing behavior, not a one-shot ask — see hr_supervisor.py, which
 * runs it every sweep while a job is open) so it's derived straight from
 * job state instead: shown whenever it WILL run at the next scheduler
 * sweep, not only while literally mid-request. */
export function deriveAgentActivity(
  job: {
    id: string;
    automation_level: string;
    status: string;
    pipeline_phase: string;
    active_headhunter_ids: string[];
  },
  openSuggestions: { job_id: string | null; status: string; agent: string | null; kind: string }[],
): AgentActivityLine[] {
  const lines: AgentActivityLine[] = [];
  const running = job.automation_level === "auto" && job.status === "Active";

  // ── Lines backed by open suggestion rows ─────────────────────────────────
  const groups = new Map<string, { agent: string; kind: string; count: number }>();
  for (const s of openSuggestions) {
    if (s.job_id !== job.id || s.status !== "open") continue;
    // Legacy rows written before agent attribution (0004) carry no agent —
    // every open kind except the communication-drafted ones is authored by
    // candidate-management, so that's the reasonable default rather than
    // mislabeling them with an unrelated fallback.
    const agent = s.agent ?? "candidate-management";
    const key = `${agent}:${s.kind}`;
    const g = groups.get(key);
    if (g) g.count += 1;
    else groups.set(key, { agent, kind: s.kind, count: 1 });
  }
  for (const g of groups.values()) {
    const meta = agentLabel(g.agent);
    lines.push({
      key: `${g.agent}:${g.kind}`,
      label: meta.label,
      color: meta.color,
      text: agentActivityPhrase(g.agent, g.kind),
      count: g.count,
    });
  }

  // ── Standing behaviors, derived from job state ───────────────────────────
  // Sourcing, evaluating and shortlisting leave no OPEN suggestion row to key
  // off: sourcing is continuous, and evaluation/shortlisting only ever write
  // already-done announcements. Without these the feed sits empty for the
  // whole Evaluation phase even while Aura is actively working the role. Each
  // is skipped when a real suggestion already speaks for that agent, so the
  // concrete "waiting on you" line always wins over the generic one.
  const spokenFor = new Set([...groups.values()].map((g) => g.agent));
  function standing(agent: string, key: string, text: string) {
    if (spokenFor.has(agent)) return;
    const meta = agentLabel(agent);
    lines.push({ key, label: meta.label, color: meta.color, text, count: 0 });
  }

  const sourcingPhase =
    job.pipeline_phase === "open-hiring" || job.pipeline_phase === "evaluation";
  if (running && sourcingPhase && job.active_headhunter_ids.length > 0) {
    standing(
      "headhunter-sourcing",
      "headhunter-sourcing",
      job.pipeline_phase === "evaluation"
        ? "are topping up the candidate pool"
        : "are sourcing candidates",
    );
  }

  if (running && job.pipeline_phase === "evaluation") {
    standing("evaluation", "evaluation", "is scoring applicants against this role");
    standing(
      "candidate-management",
      "candidate-management:shortlisting",
      "is shortlisting the candidates who clear your minimum score",
    );
  }

  return lines;
}
