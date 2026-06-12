"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { candidates } from "../data";

export default function CandidatesPage() {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("All stages");
  const [activity, setActivity] = useState("All activity");
  const filtered = useMemo(
    () =>
      candidates.filter((candidate) => {
        const matchesQuery =
          `${candidate.name} ${candidate.role} ${candidate.skills.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase());
        const matchesActivity =
          activity === "All activity" ||
          (activity === "Applied" && candidate.applied) ||
          (activity === "Interview attempted" &&
            candidate.interviewAttempted) ||
          (activity === "Both" &&
            candidate.applied &&
            candidate.interviewAttempted);
        return (
          matchesQuery &&
          matchesActivity &&
          (stage === "All stages" || candidate.stage === stage)
        );
      }),
    [query, stage, activity],
  );

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent pipeline</p>
          <h1>Candidates</h1>
          <p>
            One scorecard for resume strength, skills, preferences, and
            interview performance.
          </p>
        </div>
        <button className="btn btn-primary">Invite candidate</button>
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
          value={stage}
          onChange={(event) => setStage(event.target.value)}
        >
          <option>All stages</option>
          <option>New</option>
          <option>Screening</option>
          <option>Assessment</option>
          <option>Interview</option>
          <option>Final review</option>
        </select>
        <select
          className="select"
          value={activity}
          onChange={(event) => setActivity(event.target.value)}
        >
          <option>All activity</option>
          <option>Applied</option>
          <option>Interview attempted</option>
          <option>Both</option>
        </select>
        <select className="select" aria-label="Filter by role">
          <option>All roles</option>
          <option>Senior Product Designer</option>
          <option>Frontend Engineer</option>
          <option>AI Product Manager</option>
        </select>
        <span className="candidate-result-count">
          {filtered.length} candidates
        </span>
      </div>
      <div className="panel candidate-table-wrap">
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Activity</th>
              <th>Stage</th>
              <th>Resume</th>
              <th>Interview</th>
              <th>Overall match</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <div className="candidate-cell">
                    <span className="candidate-avatar">
                      {candidate.initials}
                    </span>
                    <div>
                      <strong>{candidate.name}</strong>
                      <small>
                        {candidate.role} · {candidate.location}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="candidate-activity">
                    {candidate.applied && (
                      <span className="chip chip-tier-high">Applied</span>
                    )}
                    {candidate.interviewAttempted && (
                      <span className="chip">Interview</span>
                    )}
                    {!candidate.applied && !candidate.interviewAttempted && (
                      <span className="chip">Profile match</span>
                    )}
                  </div>
                </td>
                <td>
                  <span className="chip">{candidate.stage}</span>
                </td>
                <td>
                  <span className="signal-score">{candidate.resume}</span>
                </td>
                <td>
                  {candidate.interviewAttempted ? (
                    <span className="signal-score">{candidate.interview}</span>
                  ) : (
                    <span className="signal-missing">Not attempted</span>
                  )}
                </td>
                <td>
                  <div className="match-cell">
                    <b>{candidate.score}%</b>
                    <span>
                      <i style={{ width: `${candidate.score}%` }} />
                    </span>
                  </div>
                </td>
                <td>
                  <Link
                    href={`/employer/candidates/${candidate.id}`}
                    className="table-action"
                  >
                    Review →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">
            <h3>No candidates found</h3>
            <p>Try a broader search or another pipeline stage.</p>
          </div>
        )}
      </div>
    </div>
  );
}
