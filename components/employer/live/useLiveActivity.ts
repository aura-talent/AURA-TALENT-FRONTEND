"use client";

/**
 * Data layer for the live activity dock.
 *
 * Aura's automation runs in a 60s server-side sweep the employer never sees.
 * This hook is the window into it: two employer-wide requests per tick, from
 * which every automated job's state is derived client-side.
 *
 * Two rules shape everything here:
 *
 *   1. NEVER fan out per job. `deriveAgentActivity` filters suggestions by
 *      job_id internally, so ONE listSuggestedActions("open") call feeds every
 *      row. (JobActivityFeed fetches per mounted instance — fine for one job
 *      page, an N+1 storm in a list.) Two employer-wide calls, whatever the
 *      job count.
 *
 *   2. Cost nothing when nobody's looking. Polling slows to the shell's own
 *      60s cadence when the dock is closed and stops entirely when the tab is
 *      hidden.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { employerApi, type EmployerJob, type SuggestedAction } from "@/lib/employerApi";
import { defaultPipelinePhases } from "@/app/employer/data";
import {
  COMPLETED_ANNOUNCEMENT_KINDS,
  deriveAgentActivity,
  type AgentActivityLine,
} from "@/lib/agentLabels";

export const POLL_OPEN_MS = 15_000;
const POLL_CLOSED_MS = 60_000;

/** waiting = the employer is the blocker; working = agents are mid-flight. */
export type LiveStatus = "waiting" | "working" | "idle" | "paused";

export type LiveJobRow = {
  job: EmployerJob;
  phaseLabel: string;
  phaseColor: string;
  lines: AgentActivityLine[];
  waiting: SuggestedAction[];
  status: LiveStatus;
};

/** Jobs bucketed by pipeline phase, in pipeline order — the panel's structure,
 * so a glance answers "where is everything?" before "what is it doing?". */
export type LivePhaseGroup = {
  phaseId: string;
  label: string;
  color: string;
  rows: LiveJobRow[];
};

export type LiveActivity = {
  rows: LiveJobRow[];
  groups: LivePhaseGroup[];
  /** Every job, not just automated ones — lets the panel tell "you have no
   * jobs" apart from "none of your jobs are automated". */
  totalJobs: number;
  totalWaiting: number;
  lastCheckedAt: number | null;
  polling: boolean;
  error: boolean;
  /** Job ids whose state moved on the most recent poll — drives the row flash. */
  changed: Set<string>;
  refresh: () => void;
};

const STATUS_ORDER: Record<LiveStatus, number> = {
  waiting: 0,
  working: 1,
  idle: 2,
  paused: 3,
};

const PHASE_META = new Map(defaultPipelinePhases.map((p) => [p.id, p]));
const PHASE_ORDER = defaultPipelinePhases.map((p) => p.id);

function groupByPhase(rows: LiveJobRow[]): LivePhaseGroup[] {
  const byPhase = new Map<string, LiveJobRow[]>();
  for (const row of rows) {
    const key = row.job.pipeline_phase;
    (byPhase.get(key) ?? byPhase.set(key, []).get(key)!).push(row);
  }
  return [...byPhase.entries()]
    .sort(([a], [b]) => {
      // Known phases in pipeline order; anything custom falls to the end.
      const ia = PHASE_ORDER.indexOf(a);
      const ib = PHASE_ORDER.indexOf(b);
      return (ia < 0 ? PHASE_ORDER.length : ia) - (ib < 0 ? PHASE_ORDER.length : ib);
    })
    .map(([phaseId, groupRows]) => ({
      phaseId,
      ...phaseMeta(phaseId),
      rows: groupRows,
    }));
}

function phaseMeta(id: string): { label: string; color: string } {
  const known = PHASE_META.get(id);
  if (known) return { label: known.label, color: known.color };
  // Employer-configurable phases can carry ids we don't know statically.
  return { label: id.replace(/[-_]/g, " "), color: "var(--ink-30)" };
}

/** Human label for a raw phase id — so audit events read the same way as the
 * job rows above them rather than leaking the underlying id. */
export function phaseLabelOf(id: string | null | undefined): string {
  return id ? phaseMeta(id).label : "—";
}

/** Compact fingerprint of everything the row renders, so we can tell a real
 * change from a re-fetch that returned identical data. */
function signatureOf(row: LiveJobRow): string {
  return [
    row.job.pipeline_phase,
    row.job.status,
    row.job.automation_level,
    row.job.active_headhunter_ids.length,
    row.waiting.length,
    row.lines.map((l) => `${l.key}#${l.count}`).sort().join("|"),
  ].join("~");
}

function buildRows(jobs: EmployerJob[], open: SuggestedAction[]): LiveJobRow[] {
  return jobs
    .filter((job) => job.automation_level === "auto")
    .map((job) => {
      const lines = deriveAgentActivity(job, open);
      const waiting = open.filter(
        (a) => a.job_id === job.id && !COMPLETED_ANNOUNCEMENT_KINDS.has(a.kind),
      );
      const meta = phaseMeta(job.pipeline_phase);
      const status: LiveStatus =
        job.status !== "Active"
          ? "paused"
          : waiting.length > 0
            ? "waiting"
            : lines.length > 0
              ? "working"
              : "idle";
      return { job, phaseLabel: meta.label, phaseColor: meta.color, lines, waiting, status };
    })
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.job.title.localeCompare(b.job.title),
    );
}

export function useLiveActivity(open: boolean): LiveActivity {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(false);
  const [changed, setChanged] = useState<Set<string>>(new Set());

  // Monotonic run id: a manual refresh racing the interval must not lose to
  // whichever response happens to land second.
  const runIdRef = useRef(0);
  const aliveRef = useRef(true);
  const signaturesRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  const poll = useCallback(async () => {
    const runId = ++runIdRef.current;
    setPolling(true);
    try {
      const [nextJobs, nextActions] = await Promise.all([
        employerApi.listJobs(),
        employerApi.listSuggestedActions("open"),
      ]);
      if (!aliveRef.current || runId !== runIdRef.current) return;

      // Diff before committing, so the flash marks what actually moved.
      const next = new Map(
        buildRows(nextJobs, nextActions).map((r) => [r.job.id, signatureOf(r)]),
      );
      const previous = signaturesRef.current;
      const moved = new Set<string>();
      for (const [id, sig] of next) {
        // Only flag jobs we've seen before — a first load isn't "activity".
        if (previous.size > 0 && previous.has(id) && previous.get(id) !== sig) {
          moved.add(id);
        }
      }
      signaturesRef.current = next;

      setJobs(nextJobs);
      setActions(nextActions);
      setTotalJobs(nextJobs.length);
      setChanged(moved);
      setError(false);
      setLastCheckedAt(Date.now());
    } catch {
      // Keep the last good rows — a transient failure must not blank the dock.
      if (aliveRef.current && runId === runIdRef.current) setError(true);
    } finally {
      if (aliveRef.current && runId === runIdRef.current) setPolling(false);
    }
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    function stop() {
      if (interval) clearInterval(interval);
      interval = null;
    }
    function start() {
      stop();
      interval = setInterval(poll, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    }
    function onVisibility() {
      if (document.hidden) {
        stop();
      } else {
        poll();
        start();
      }
    }

    // Deferred rather than called inline: the first poll flips `polling` and
    // would otherwise cascade a second render before the shell has painted.
    const kickoff = setTimeout(poll, 0);
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(kickoff);
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [open, poll]);

  const rows = useMemo(() => buildRows(jobs, actions), [jobs, actions]);
  const groups = useMemo(() => groupByPhase(rows), [rows]);
  const totalWaiting = useMemo(
    () => rows.reduce((sum, r) => sum + r.waiting.length, 0),
    [rows],
  );

  return {
    rows,
    groups,
    totalJobs,
    totalWaiting,
    lastCheckedAt,
    polling,
    error,
    changed,
    refresh: poll,
  };
}
