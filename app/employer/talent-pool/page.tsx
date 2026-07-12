"use client";

import { useEffect, useMemo, useState } from "react";
import {
  candidateInitials,
  employerApi,
  type CandidateEvaluation,
  type EmployerHeadhunter,
  type EmployerJob,
  type TalentPoolEntry,
} from "@/lib/employerApi";
import HeadhunterBadge from "@/components/employer/HeadhunterBadge";
import CandidateOverviewModal from "@/components/employer/CandidateOverviewModal";
import { Loader } from "@/components/ui/loader";

const sortOptions = ["Top match", "Name A–Z", "Newest"] as const;
type SortOption = (typeof sortOptions)[number];

function scoreTone(score: number) {
  if (score >= 90) return "strong";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  return "weak";
}

function bestEvaluation(entry: TalentPoolEntry): CandidateEvaluation | null {
  const evaluations = entry.evaluations ?? [];
  if (!evaluations.length) return null;
  return [...evaluations].sort(
    (a, b) => (b.wlc_score ?? -1) - (a.wlc_score ?? -1),
  )[0];
}

function CandidateCard({
  entry,
  headhunters,
  onSelect,
}: {
  entry: TalentPoolEntry;
  headhunters: EmployerHeadhunter[];
  onSelect: (id: string) => void;
}) {
  const evaluation = bestEvaluation(entry);
  const score = evaluation?.wlc_score != null ? Math.round(evaluation.wlc_score) : null;
  const headhunter =
    evaluation?.source === "headhunter" && evaluation.headhunter_id
      ? headhunters.find((item) => item.id === evaluation.headhunter_id)
      : undefined;
  return (
    <button
      type="button"
      className="panel talent-pool-card"
      onClick={() => onSelect(entry.id)}
    >
      <header>
        <span className="candidate-avatar">{candidateInitials(entry.full_name)}</span>
        <div>
          <strong>{entry.full_name ?? entry.email ?? "Candidate"}</strong>
          <small>{evaluation?.job_title ?? "In talent pool"}</small>
        </div>
        {score != null && (
          <span className={`talent-pool-score ${scoreTone(score)}`}>{score}%</span>
        )}
      </header>
      <span className="talent-pool-bar">
        <i style={{ width: `${score ?? 0}%` }} />
      </span>
      <div className="talent-pool-card-meta">
        {evaluation?.interview_evaluation && (
          <span className="chip chip-tier-high">✓ Interview</span>
        )}
        {!evaluation && <span className="chip">Not evaluated</span>}
        {headhunter && <HeadhunterBadge name={headhunter.name} compact />}
      </div>
      <p className="talent-pool-card-skills">
        {(evaluation?.matched_keywords ?? []).slice(0, 3).join(" · ") ||
          (entry.resume ? "Resume on file" : "No resume yet")}
      </p>
      <footer>
        <span>{entry.email}</span>
        <span className="talent-pool-go">→</span>
      </footer>
    </button>
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

  const rows = useMemo(() => {
    const filtered = pool.filter((entry) => {
      const evaluation = bestEvaluation(entry);
      const haystack = `${entry.full_name ?? ""} ${entry.email ?? ""} ${(
        evaluation?.matched_keywords ?? []
      ).join(" ")}`.toLowerCase();
      const matchesQuery = haystack.includes(query.toLowerCase());
      const matchesJob =
        jobFilter === "All roles" ||
        (entry.evaluations ?? []).some((e) => e.job_id === jobFilter);
      const attempted = Boolean(evaluation?.interview_evaluation);
      const matchesInterview =
        interviewFilter === "All candidates" ||
        (interviewFilter === "Interview attempted" && attempted) ||
        (interviewFilter === "Not attempted" && !attempted);
      return matchesQuery && matchesJob && matchesInterview;
    });
    const sorted = [...filtered];
    if (sortBy === "Name A–Z") {
      sorted.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    } else if (sortBy === "Newest") {
      sorted.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    } else {
      sorted.sort(
        (a, b) =>
          (bestEvaluation(b)?.wlc_score ?? -1) - (bestEvaluation(a)?.wlc_score ?? -1),
      );
    }
    return sorted;
  }, [pool, query, jobFilter, interviewFilter, sortBy]);

  const spotlighted = useMemo(
    () =>
      pool.filter((entry) =>
        (entry.evaluations ?? []).some((e) => e.source === "headhunter"),
      ),
    [pool],
  );

  const selectedEntry = pool.find((entry) => entry.id === selectedId);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent re-engagement</p>
          <h1>Talent pool</h1>
          <p>
            Scan, compare, and reconnect with every candidate relevant to your
            roles — best matches first.
          </p>
        </div>
        <span className="chip chip-tier-high">{pool.length} in pool</span>
      </div>

      <div className="candidate-toolbar panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidates or skills"
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
        <span className="candidate-result-count">{rows.length} candidates</span>
      </div>

      {spotlighted.length > 0 && (
        <section className="talent-pool-spotlight">
          <div className="talent-pool-spotlight-head">
            <h2>✦ Suggested by your headhunters</h2>
            <span>{spotlighted.length} candidates found</span>
          </div>
          <div className="talent-pool-grid">
            {spotlighted.map((entry) => (
              <CandidateCard
                key={entry.id}
                entry={entry}
                headhunters={headhunters}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="panel">
          <Loader label="Loading talent pool…" />
        </div>
      ) : (
        <div className="talent-pool-grid">
          {rows.map((entry) => (
            <CandidateCard
              key={entry.id}
              entry={entry}
              headhunters={headhunters}
              onSelect={setSelectedId}
            />
          ))}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="empty-state panel">
          <h3>No candidates found</h3>
          <p>Try a broader search or clear a filter.</p>
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
