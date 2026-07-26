"use client";

/**
 * Live activity dock — a persistent, page-independent view of what Aura's
 * agents are doing right now.
 *
 * It lives in EmployerShell (rendered by app/employer/layout.tsx), so only
 * `children` swaps on navigation and this component — with its open state,
 * expanded rows and poll timer — survives untouched. That's the whole reason
 * it isn't a page-level component.
 *
 * Structure before detail: jobs are grouped by pipeline phase, so a glance
 * answers "where is everything?" first. A job's body carries only what's
 * actionable — what an agent is doing, or what's waiting on you — and one
 * quiet line when the answer is "nothing". Completed history deliberately
 * isn't here; that's the Audit Trail's job, and mixing the two is what made
 * this panel noisy.
 *
 * Deliberately NOT a dialog: no role="dialog", no focus trap, no backdrop.
 * This is an ambient monitor you glance at while working, and trapping focus
 * would fight the actual task. Esc is handled on the panel itself so it can't
 * steal the key from a modal or the product tour.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { timeAgo } from "@/lib/employerApi";
import {
  POLL_OPEN_MS,
  useLiveActivity,
  type LiveJobRow,
} from "./useLiveActivity";
import styles from "./LiveActivityPanel.module.css";

const OPEN_KEY = "aura_live_open";
const EXPANDED_KEY = "aura_live_expanded";

function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeStore(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode — the dock just won't remember */
  }
}

function Chevron({ up }: { up: boolean }) {
  return (
    <svg
      className={`${styles.chevron} ${up ? styles.chevronUp : ""}`}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Dot state is the panel's core signal, so keep the mapping in one place. */
function dotClass(waiting: number, live: boolean): string {
  if (waiting > 0) return `${styles.dot} ${styles.dotWaiting}`;
  return live ? styles.dot : `${styles.dot} ${styles.dotIdle}`;
}

/** timeAgo against a server clock can read negative on a skewed client. */
function stamp(iso: string): string {
  return new Date(iso).getTime() > Date.now() ? "just now" : timeAgo(iso);
}

function JobBody({ row }: { row: LiveJobRow }) {
  const working = row.lines.length > 0;
  const waiting = row.waiting.length > 0;

  return (
    <>
      {working && (
        <ul className={styles.lines}>
          {row.lines.map((line) => (
            <li key={line.key} className={styles.line}>
              <span className={styles.lineDot} style={{ background: line.color }} />
              <span>
                <span className={styles.lineLabel} style={{ color: line.color }}>
                  {line.label}
                </span>
                <span className={styles.lineText}>
                  {line.text}
                  {line.count > 1 ? ` (${line.count})` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {waiting && (
        <>
          <p className={styles.sectionLabel}>Waiting on you</p>
          {row.waiting.slice(0, 3).map((action) => (
            <span key={action.id} className={styles.waitingItem}>
              {action.title}
              <span className={styles.stamp}>{stamp(action.created_at)}</span>
            </span>
          ))}
        </>
      )}

      {/* Nothing running and nothing pending — say so in one line rather than
          leaving an empty box the reader has to interpret. */}
      {!working && !waiting && (
        <p className={styles.hint}>
          {row.status === "paused"
            ? "Idle — this role is a Draft. Aura starts once you set it Active."
            : "Idle — nothing to do on this role right now."}
        </p>
      )}

      <div className={styles.jobLinks}>
        <Link className={styles.jobLink} href={`/employer/jobs/${row.job.id}`}>
          Open role →
        </Link>
        {waiting && (
          <Link className={styles.jobLink} href="/employer">
            Review actions →
          </Link>
        )}
      </div>
    </>
  );
}

export default function LiveActivityPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // "Now", refreshed once a second while open. Held in state rather than read
  // during render: Date.now() in a render body is impure and would make the
  // component's output depend on when React happened to run it.
  const [now, setNow] = useState<number | null>(null);
  const pillRef = useRef<HTMLButtonElement>(null);

  // localStorage is read in an effect, never a useState initializer — the shell
  // server-renders, and seeding state from storage would desync hydration.
  // Deferred (setTimeout, not requestAnimationFrame — rAF is paused in a
  // background tab, so the dock would silently fail to restore for anyone who
  // opens the app in one) so the restore doesn't cascade a render before paint.
  useEffect(() => {
    const timer = setTimeout(() => {
      setOpen(readStore(OPEN_KEY, false));
      setExpanded(new Set(readStore<string[]>(EXPANDED_KEY, [])));
      setHydrated(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Drives "checked Ns ago" and every relative timestamp. Only while open.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  const { rows, groups, totalJobs, totalWaiting, lastCheckedAt, polling, error, changed, refresh } =
    useLiveActivity(open);

  const working = rows.filter((r) => r.status === "working").length;
  const live = working > 0;

  const toggleOpen = useCallback(() => {
    setOpen((current) => {
      writeStore(OPEN_KEY, !current);
      return !current;
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    writeStore(OPEN_KEY, false);
    pillRef.current?.focus();
  }, []);

  function toggleJob(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      // Prune ids for jobs that no longer exist so storage can't grow forever.
      const living = new Set(rows.map((r) => r.job.id));
      for (const key of next) if (!living.has(key)) next.delete(key);
      writeStore(EXPANDED_KEY, [...next]);
      return next;
    });
  }

  const secondsAgo =
    lastCheckedAt && now ? Math.max(0, Math.round((now - lastCheckedAt) / 1000)) : null;

  // The one-line answer to "what's going on?", before any detail.
  const headline = live
    ? `Aura is working ${working} role${working === 1 ? "" : "s"}`
    : totalWaiting > 0
      ? `Idle — ${totalWaiting} thing${totalWaiting === 1 ? "" : "s"} waiting on you`
      : "Idle — nothing running";

  return (
    <>
      {/* Pill first in the DOM so Tab flows pill → panel naturally. */}
      <button
        ref={pillRef}
        type="button"
        className={`${styles.pill} ${live ? "" : styles.pillIdle}`}
        aria-expanded={open}
        aria-controls="live-activity-panel"
        aria-label={
          `Live agent activity: ${working} role${working === 1 ? "" : "s"} running` +
          (totalWaiting > 0 ? `, ${totalWaiting} waiting on you` : "")
        }
        onClick={toggleOpen}
      >
        <span className={dotClass(totalWaiting, live)} aria-hidden="true" />
        <span className={styles.pillLabel}>{live ? "Live" : "Idle"}</span>
        {(live || totalWaiting > 0) && (
          <span
            className={`${styles.pillCount} ${totalWaiting > 0 ? styles.pillCountWaiting : ""}`}
            aria-hidden="true"
          >
            {totalWaiting > 0 ? totalWaiting : working}
          </span>
        )}
        <Chevron up={!open} />
      </button>

      {open && (
        <aside
          id="live-activity-panel"
          className={`${styles.panel} ${hydrated ? styles.panelIn : ""}`}
          role="region"
          aria-label="Live agent activity"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              close();
            }
          }}
        >
          <header className={styles.head}>
            <h2 className={styles.headTitle}>
              <span className={dotClass(totalWaiting, live)} aria-hidden="true" />
              Live activity
            </h2>
            <button
              type="button"
              className={`${styles.iconBtn} ${polling ? styles.spinning : ""}`}
              onClick={refresh}
              aria-label="Refresh now"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path
                  d="M12.5 7a5.5 5.5 0 1 1-1.7-3.97M12.5 1.5V5H9"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button type="button" className={styles.iconBtn} onClick={close} aria-label="Close live activity">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </header>

          <p className={styles.meta}>
            {headline}
            <span className={styles.metaTick} aria-hidden="true">
              {secondsAgo === null ? " · checking…" : ` · checked ${secondsAgo}s ago`}
            </span>
          </p>

          {/* A stable summary for screen readers — the 1s ticker above is
              aria-hidden so it can't announce every second. */}
          <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
            {working} role{working === 1 ? "" : "s"} active, {totalWaiting} waiting on you.
          </p>

          {/* Keyed on the poll timestamp so React remounts it and the sweep
              animation restarts on every successful check. */}
          <div className={styles.heartbeat} key={lastCheckedAt ?? 0} aria-hidden="true" />

          {groups.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>
                {totalJobs === 0 ? "No roles yet" : "No automated roles"}
              </p>
              <p className={styles.emptyBody}>
                {totalJobs === 0 ? (
                  <>
                    Create one from <Link href="/employer/jobs/new">Job listings</Link> and Aura
                    starts working it.
                  </>
                ) : (
                  <>
                    Switch a role to <strong>Auto</strong> in its pipeline settings to watch
                    Aura work it here.
                  </>
                )}
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {groups.map((group) => (
                <section key={group.phaseId} className={styles.group}>
                  <h3 className={styles.groupHead}>
                    <i className={styles.phaseSwatch} style={{ background: group.color }} />
                    {group.label}
                    <span className={styles.groupCount}>{group.rows.length}</span>
                  </h3>
                  <ul className={styles.groupRows}>
                    {group.rows.map((row) => {
                      const isOpen = expanded.has(row.job.id);
                      return (
                        <li
                          key={row.job.id}
                          className={`${styles.jobRow} ${changed.has(row.job.id) ? styles.rowFlash : ""}`}
                        >
                          <button
                            type="button"
                            className={styles.jobHead}
                            aria-expanded={isOpen}
                            aria-controls={`live-job-${row.job.id}`}
                            onClick={() => toggleJob(row.job.id)}
                          >
                            <Chevron up={isOpen} />
                            <span className={styles.jobTitle}>{row.job.title}</span>
                            <span className={styles.jobBadges}>
                              {row.status === "paused" && <em className={styles.pausedTag}>Draft</em>}
                              {row.waiting.length > 0 && (
                                <em className={styles.waitingBadge}>{row.waiting.length}</em>
                              )}
                              {row.status !== "paused" && (
                                <span
                                  className={dotClass(row.waiting.length, row.lines.length > 0)}
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          </button>

                          <div id={`live-job-${row.job.id}`} className={styles.body} hidden={!isOpen}>
                            {isOpen && <JobBody row={row} />}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <footer className={styles.foot}>
            {error ? (
              <span className={styles.errorNote}>⚠ Reconnecting…</span>
            ) : (
              <span>Refreshes every {Math.round(POLL_OPEN_MS / 1000)}s</span>
            )}
          </footer>
        </aside>
      )}
    </>
  );
}
