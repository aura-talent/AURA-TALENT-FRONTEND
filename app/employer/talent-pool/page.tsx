"use client";

/**
 * Talent pool.
 *
 * One card per person, never more. A candidate scored against three of
 * your roles is one card carrying three ledger lines — not three cards,
 * and not one card that silently shows only their best role.
 *
 * Everyone lives in exactly one of two places: the headhunter enclosure
 * (grouped under the persona that found them) or the direct pool below
 * it. A candidate found by more than one headhunter is filed under the
 * one that scored them highest, with the others named on the card, so
 * the "exactly once" rule holds without losing the connection.
 */

import { useEffect, useMemo, useState } from "react";
import {
  candidateInitials,
  employerApi,
  type CandidateEvaluation,
  type EmployerHeadhunter,
  type EmployerJob,
  type TalentPoolEntry,
} from "@/lib/employerApi";
import { headhunterInitials } from "@/app/employer/data";
import CandidateOverviewModal from "@/components/employer/CandidateOverviewModal";
import { Loader } from "@/components/ui/loader";
import styles from "./talent-pool.module.css";

const sortOptions = ["Top match", "Name A–Z", "Newest"] as const;
type SortOption = (typeof sortOptions)[number];

/** Two lenses on the same people: the complete list, or only the ones a
 *  headhunter surfaced, filed under whoever found them. */
type View = "everyone" | "headhunters";

/** How a candidate arrived on a role. The mark is what the ledger
 *  renders; the label spells it out in the legend and the tooltip. */
const SOURCE_MARK = {
  applied: { mark: "A", label: "Applied", className: styles.markApplied },
  headhunter: { mark: "S", label: "Sourced by a headhunter", className: styles.markSourced },
  aura: { mark: "M", label: "Matched by Aura", className: "" },
} as const;

const SOURCE_KEYS = ["applied", "headhunter", "aura"] as const;

/** One line of a candidate's ledger: a role they've been scored against. */
type LedgerEntry = {
  jobId: string;
  jobTitle: string;
  score: number | null;
  source: CandidateEvaluation["source"];
  headhunterId: string | null;
};

type Person = {
  entry: TalentPoolEntry;
  name: string;
  ledger: LedgerEntry[];
  topScore: number | null;
  /** The headhunter that scored them highest, if any — the group they file under. */
  finderId: string | null;
  /** Any other headhunters that also found them, named on the card. */
  alsoFoundBy: string[];
  interviewed: boolean;
};

function scoreTone(score: number | null) {
  if (score == null) return "none";
  if (score >= 90) return "strong";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  return "weak";
}

function toPerson(entry: TalentPoolEntry): Person {
  const evaluations = entry.evaluations ?? (entry.evaluation ? [entry.evaluation] : []);
  // One line per role, best score wins: a person folded together from
  // duplicate user rows can carry two evaluations for the same job.
  const byJob = new Map<string, LedgerEntry>();
  for (const e of evaluations) {
    const line: LedgerEntry = {
      jobId: e.job_id,
      jobTitle: e.job_title ?? "Untitled role",
      score: e.wlc_score == null ? null : Math.round(e.wlc_score),
      source: e.source,
      headhunterId: e.headhunter_id,
    };
    const seen = byJob.get(line.jobId);
    if (!seen || (line.score ?? -1) > (seen.score ?? -1)) byJob.set(line.jobId, line);
  }
  const ledger = [...byJob.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  // Best-scoring headhunter find decides the group, so a candidate two
  // personas both surfaced still appears exactly once.
  const sourced = ledger.filter((l) => l.source === "headhunter" && l.headhunterId);
  const finderId = sourced[0]?.headhunterId ?? null;
  const alsoFoundBy = [
    ...new Set(sourced.map((l) => l.headhunterId!).filter((id) => id !== finderId)),
  ];

  return {
    entry,
    name: entry.full_name ?? entry.email ?? "Candidate",
    ledger,
    topScore: ledger[0]?.score ?? null,
    finderId,
    alsoFoundBy,
    interviewed: evaluations.some((e) => Boolean(e.interview_evaluation)),
  };
}

/** Two lines is the card's budget. The ledger is sorted best-first, so the
 *  two that show are the two worth reading; the rest are a count. */
const LEDGER_LIMIT = 2;

function CandidateCard({
  person,
  onSelect,
}: {
  person: Person;
  onSelect: (id: string) => void;
}) {
  const shown = person.ledger.slice(0, LEDGER_LIMIT);
  const hidden = person.ledger.length - shown.length;

  return (
    <button
      type="button"
      className={styles.card}
      onClick={() => onSelect(person.entry.id)}
    >
      <header className={styles.cardHead}>
        <span className={`candidate-avatar ${styles.cardAvatar}`}>
          {candidateInitials(person.entry.full_name)}
        </span>
        <span className={styles.cardNames}>
          <strong>{person.name}</strong>
          <small>{person.entry.email ?? "No email on file"}</small>
        </span>
        <span className={`${styles.topScore} ${styles[scoreTone(person.topScore)]}`}>
          {person.topScore == null ? "—" : `${person.topScore}%`}
        </span>
      </header>

      {person.ledger.length === 0 ? (
        <p className={styles.ledgerEmpty}>Not scored against any of your roles yet.</p>
      ) : (
        <ul className={styles.ledger}>
          {shown.map((line) => {
            const source = SOURCE_MARK[line.source] ?? SOURCE_MARK.aura;
            return (
              <li key={line.jobId} className={styles.entry}>
                <i
                  className={styles.entryFill}
                  style={{ width: `${line.score ?? 0}%` }}
                  aria-hidden="true"
                />
                <span className={`${styles.mark} ${source.className}`} title={source.label}>
                  {source.mark}
                  <span className={styles.srOnly}>{source.label}</span>
                </span>
                <span className={styles.entryJob}>{line.jobTitle}</span>
                <span className={`${styles.entryScore} ${styles[scoreTone(line.score)]}`}>
                  {line.score == null ? "—" : `${line.score}%`}
                </span>
              </li>
            );
          })}
          {hidden > 0 && (
            <li className={styles.ledgerMore}>
              +{hidden} more role{hidden === 1 ? "" : "s"}
            </li>
          )}
        </ul>
      )}

      <footer className={styles.cardFoot}>
        {person.interviewed && (
          <span className={`${styles.tag} ${styles.tagInterview}`}>✓ Interviewed</span>
        )}
        <span className={styles.tag}>
          {person.entry.resume ? "Resume on file" : "No resume"}
        </span>
        {person.alsoFoundBy.length > 0 && (
          <span className={styles.alsoFound}>
            Also found by {person.alsoFoundBy.length} other headhunter
            {person.alsoFoundBy.length === 1 ? "" : "s"}
          </span>
        )}
      </footer>
    </button>
  );
}

function HeadhunterBand({
  headhunter,
  people,
  open,
  onToggle,
  onSelect,
}: {
  headhunter: EmployerHeadhunter;
  people: Person[];
  open: boolean;
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const panelId = `hunter-${headhunter.id}`;
  const scored = people.map((p) => p.topScore).filter((s): s is number => s != null);
  const avg = scored.length
    ? Math.round(scored.reduce((sum, s) => sum + s, 0) / scored.length)
    : null;

  return (
    <div className={styles.band}>
      <button
        type="button"
        className={styles.bandHead}
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <span
          className={`${styles.bandChevron} ${open ? styles.bandChevronOpen : ""}`}
          aria-hidden="true"
        >
          ▶
        </span>
        <span className={`headhunter-avatar ${styles.bandAvatar}`}>
          {headhunterInitials(headhunter.name)}
        </span>
        <span className={styles.bandNames}>
          <strong>{headhunter.name}</strong>
          <small>{headhunter.persona ?? "No persona written yet"}</small>
        </span>
        {headhunter.status !== "Active" && (
          <span className={styles.bandStatus}>{headhunter.status}</span>
        )}
        <span className={styles.bandStats}>
          {people.length} found
          {avg != null && <b>{avg}% avg</b>}
        </span>
      </button>
      {open && (
        <div className={styles.bandGrid} id={panelId}>
          <div className={styles.grid}>
            {people.map((person) => (
              <CandidateCard key={person.entry.id} person={person} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function TalentPoolPage() {
  const [pool, setPool] = useState<TalentPoolEntry[]>([]);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [headhunters, setHeadhunters] = useState<EmployerHeadhunter[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("All roles");
  const [interviewFilter, setInterviewFilter] = useState("All candidates");
  const [sortBy, setSortBy] = useState<SortOption>("Top match");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("everyone");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.browsePool(),
      employerApi.listJobs(),
      employerApi.listHeadhunters(),
    ]).then(([poolRes, jobsRes, hhRes]) => {
      if (cancelled) return;
      if (poolRes.status === "fulfilled") setPool(poolRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
      if (hhRes.status === "fulfilled") setHeadhunters(hhRes.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const people = useMemo(() => pool.map(toPerson), [pool]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matched = people.filter((person) => {
      const haystack = `${person.name} ${person.entry.email ?? ""} ${person.ledger
        .map((l) => l.jobTitle)
        .join(" ")}`.toLowerCase();
      if (needle && !haystack.includes(needle)) return false;
      if (jobFilter !== "All roles" && !person.ledger.some((l) => l.jobId === jobFilter)) {
        return false;
      }
      if (interviewFilter === "Interview attempted" && !person.interviewed) return false;
      if (interviewFilter === "Not attempted" && person.interviewed) return false;
      return true;
    });

    const sorted = [...matched];
    if (sortBy === "Name A–Z") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "Newest") {
      sorted.sort(
        (a, b) =>
          new Date(b.entry.created_at).getTime() - new Date(a.entry.created_at).getTime(),
      );
    } else {
      sorted.sort((a, b) => (b.topScore ?? -1) - (a.topScore ?? -1));
    }
    return sorted;
  }, [people, query, jobFilter, interviewFilter, sortBy]);

  // The headhunter lens: the same people, filed under whoever found them.
  // A candidate two personas both surfaced files under the one that scored
  // them highest, so no band repeats a name.
  const bands = useMemo(() => {
    const known = new Map(headhunters.map((h) => [h.id, h]));
    const byHunter = new Map<string, Person[]>();
    for (const person of filtered) {
      // A find by a headhunter that no longer exists is dropped from this
      // view rather than creating a phantom group — the person is still in
      // Everyone, which is the complete list.
      if (!person.finderId || !known.has(person.finderId)) continue;
      const list = byHunter.get(person.finderId);
      if (list) list.push(person);
      else byHunter.set(person.finderId, [person]);
    }
    return [...byHunter.entries()]
      .map(([id, members]) => ({ headhunter: known.get(id)!, people: members }))
      .sort(
        (a, b) =>
          b.people.length - a.people.length ||
          a.headhunter.name.localeCompare(b.headhunter.name),
      );
  }, [filtered, headhunters]);

  const huntedTotal = bands.reduce((sum, band) => sum + band.people.length, 0);
  const shown = view === "everyone" ? filtered.length : huntedTotal;
  // While a search is running, nothing may stay hidden behind a collapsed band.
  const searching = query.trim().length > 0;
  const selectedEntry = pool.find((entry) => entry.id === selectedId);

  function toggleBand(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent re-engagement</p>
          <h1>Talent pool</h1>
          <p>Every candidate your roles have touched, once each.</p>
        </div>
        <span className="chip chip-tier-high">{pool.length} in pool</span>
      </div>

      <div className="candidate-toolbar panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people or roles"
            aria-label="Search candidates"
          />
        </label>
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
        <select
          className="select"
          aria-label="Filter by interview activity"
          value={interviewFilter}
          onChange={(event) => setInterviewFilter(event.target.value)}
        >
          <option>All candidates</option>
          <option>Interview attempted</option>
          <option>Not attempted</option>
        </select>
        <select
          className="select"
          aria-label="Sort candidates"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
        >
          {sortOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <span className="candidate-result-count">{shown} shown</span>
      </div>

      <div className={styles.viewBar}>
        <div className={styles.switch} role="tablist" aria-label="Talent pool view">
          <button
            type="button"
            role="tab"
            aria-selected={view === "everyone"}
            className={`${styles.switchTab} ${view === "everyone" ? styles.switchOn : ""}`}
            onClick={() => setView("everyone")}
          >
            Everyone <b>{filtered.length}</b>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "headhunters"}
            className={`${styles.switchTab} ${view === "headhunters" ? styles.switchOn : ""}`}
            onClick={() => setView("headhunters")}
          >
            <span aria-hidden="true">✦</span> Headhunter finds <b>{huntedTotal}</b>
          </button>
        </div>

        <p className={styles.legend}>
          {SOURCE_KEYS.map((key) => (
            <span key={key} className={styles.legendItem}>
              <span
                className={`${styles.mark} ${SOURCE_MARK[key].className}`}
                aria-hidden="true"
              >
                {SOURCE_MARK[key].mark}
              </span>
              {SOURCE_MARK[key].label}
            </span>
          ))}
        </p>
      </div>

      {loading ? (
        <div className="panel" style={{ marginTop: "1.5rem" }}>
          <Loader label="Loading talent pool…" />
        </div>
      ) : view === "everyone" ? (
        filtered.length > 0 ? (
          <div className={styles.grid}>
            {filtered.map((person) => (
              <CandidateCard
                key={person.entry.id}
                person={person}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        ) : (
          <div className="empty-state panel">
            <h3>No one matches those filters</h3>
            <p>Widen the search, or pick a different role.</p>
          </div>
        )
      ) : bands.length > 0 ? (
        <div className={styles.bands}>
          {bands.map(({ headhunter, people: members }) => (
            <HeadhunterBand
              key={headhunter.id}
              headhunter={headhunter}
              people={members}
              open={searching || !collapsed.has(headhunter.id)}
              onToggle={() => toggleBand(headhunter.id)}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state panel">
          <h3>No finds yet</h3>
          <p>
            {huntedTotal === 0 && !searching && jobFilter === "All roles"
              ? "Put a headhunter on a role and it starts scanning the pool."
              : "No sourced candidate matches those filters."}
          </p>
        </div>
      )}

      {selectedEntry && (
        <CandidateOverviewModal
          entry={selectedEntry}
          headhunters={headhunters}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
