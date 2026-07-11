"use client";

import { useMemo, useState } from "react";
import {
  candidates,
  headhunterSuggestions,
  jobs,
  stageOptions,
  talentPoolProfiles,
} from "../data";
import StageChip from "@/components/employer/StageChip";
import HeadhunterBadge from "@/components/employer/HeadhunterBadge";
import CandidateOverviewModal from "@/components/employer/CandidateOverviewModal";

const sortOptions = ["Top match", "Name A–Z", "Most experienced"] as const;
type SortOption = (typeof sortOptions)[number];

type Candidate = (typeof candidates)[number];

function scoreTone(score: number) {
  if (score >= 90) return "strong";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  return "weak";
}

function CandidateCard({
  candidate,
  onSelect,
}: {
  candidate: Candidate;
  onSelect: (id: string) => void;
}) {
  const profile = talentPoolProfiles[candidate.id];
  const suggestion = headhunterSuggestions[candidate.id];
  return (
    <button
      type="button"
      className="panel talent-pool-card"
      onClick={() => onSelect(candidate.id)}
    >
      <header>
        <span className="candidate-avatar">{candidate.initials}</span>
        <div>
          <strong>
            {candidate.name}
            {profile && (
              <i
                className="talent-pool-flag"
                title={`${profile.previousOutcome} — ${profile.reason}`}
              >
                ✦
              </i>
            )}
          </strong>
          <small>{candidate.role}</small>
        </div>
        <span className={`talent-pool-score ${scoreTone(candidate.score)}`}>
          {candidate.score}%
        </span>
      </header>
      <span className="talent-pool-bar">
        <i style={{ width: `${candidate.score}%` }} />
      </span>
      <div className="talent-pool-card-meta">
        <StageChip stage={candidate.stage} />
        {candidate.interviewAttempted && (
          <span className="chip chip-tier-high">✓ Interview</span>
        )}
        {suggestion && (
          <HeadhunterBadge headhunterId={suggestion.headhunterId} compact />
        )}
      </div>
      <p className="talent-pool-card-skills">
        {candidate.skills.slice(0, 3).join(" · ")}
        {candidate.skills.length > 3 && ` +${candidate.skills.length - 3}`}
      </p>
      <footer>
        <span>
          {candidate.experience} · {candidate.location}
        </span>
        <span className="talent-pool-go">→</span>
      </footer>
    </button>
  );
}

export default function TalentPoolPage() {
  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState("All roles");
  const [stageFilter, setStageFilter] = useState("All stages");
  const [interviewFilter, setInterviewFilter] = useState("All candidates");
  const [sortBy, setSortBy] = useState<SortOption>("Top match");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const filtered = candidates.filter((candidate) => {
      const matchesQuery =
        `${candidate.name} ${candidate.role} ${candidate.skills.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase());
      const matchesJob =
        jobFilter === "All roles" || candidate.jobId === jobFilter;
      const matchesStage =
        stageFilter === "All stages" || candidate.stage === stageFilter;
      const matchesInterview =
        interviewFilter === "All candidates" ||
        (interviewFilter === "Interview attempted" &&
          candidate.interviewAttempted) ||
        (interviewFilter === "Not attempted" && !candidate.interviewAttempted);
      return matchesQuery && matchesJob && matchesStage && matchesInterview;
    });
    const sorted = [...filtered];
    if (sortBy === "Name A–Z") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "Most experienced") {
      sorted.sort((a, b) => parseInt(b.experience) - parseInt(a.experience));
    } else {
      sorted.sort((a, b) => b.score - a.score);
    }
    return sorted;
  }, [query, jobFilter, stageFilter, interviewFilter, sortBy]);

  const spotlighted = useMemo(
    () => candidates.filter((candidate) => headhunterSuggestions[candidate.id]),
    [],
  );

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

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
        <span className="chip chip-tier-high">{candidates.length} in pool</span>
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
          aria-label="Filter by stage"
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
        >
          <option>All stages</option>
          {stageOptions.map((option) => (
            <option key={option}>{option}</option>
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
            <span>{spotlighted.length} new candidates found</span>
          </div>
          <div className="talent-pool-grid">
            {spotlighted.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                onSelect={setSelectedId}
              />
            ))}
          </div>
        </section>
      )}

      <div className="talent-pool-grid">
        {rows.map((candidate) => (
          <CandidateCard
            key={candidate.id}
            candidate={candidate}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {rows.length === 0 && (
        <div className="empty-state panel">
          <h3>No candidates found</h3>
          <p>Try a broader search or clear a filter.</p>
        </div>
      )}

      {selectedCandidate && (
        <CandidateOverviewModal
          candidate={selectedCandidate}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
