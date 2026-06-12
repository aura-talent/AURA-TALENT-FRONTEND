"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { jobs } from "../employer/data";

export default function ExploreJobsPage() {
  const [query, setQuery] = useState("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const visibleJobs = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.status === "Active" &&
          (!recommendedOnly || job.recommended) &&
          `${job.title} ${job.team} ${job.keywords.join(" ")}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [query, recommendedOnly],
  );

  return (
    <div className="app-sheet">
    <div className="container candidate-jobs-page">
      <div className="candidate-jobs-hero">
        <div>
          <p className="eyebrow">(01) // AGENT_MATCHED</p>
          <h1>Jobs that fit where you&apos;re going.</h1>
          <p>
            Aura uses your skills, experience, career direction, compensation
            preferences, and culture signals to rank every role.
          </p>
        </div>
        <div className="recommendation-summary">
          <span className="eval-tick eval-tick-tl" />
          <span className="eval-tick eval-tick-tr" />
          <span className="eval-tick eval-tick-bl" />
          <span className="eval-tick eval-tick-br" />
          <span>PROFILE_STRENGTH</span>
          <strong>92%</strong>
          <p>Resume and preferences are ready for matching.</p>
          <Link href="/onboarding">Update profile →</Link>
        </div>
      </div>

      <div className="jobs-explore-toolbar panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search roles, skills, or teams"
          />
        </label>
        <label className="recommended-toggle">
          <input
            type="checkbox"
            checked={recommendedOnly}
            onChange={(event) => setRecommendedOnly(event.target.checked)}
          />
          <span>Recommended only</span>
        </label>
        <Link href="/scan" className="btn btn-ghost">
          Scan external jobs
        </Link>
      </div>

      <div className="jobs-explore-head">
        <div>
          <h2>Recommended for your profile</h2>
          <p>{visibleJobs.length} ACTIVE_ROLES // RANKED_BY_AURA</p>
        </div>
        <span className="chip chip-tier-high">Agent refreshed today</span>
      </div>
      <div className="candidate-job-grid">
        {visibleJobs.map((job) => (
          <article className="panel candidate-job-card" key={job.id}>
            <header>
              <div className="job-company-mark">N</div>
              <div>
                <span>{job.company}</span>
                <small>{job.team}</small>
              </div>
              <div className="job-match-badge">
                <strong>{job.fit}%</strong>
                <span>match</span>
              </div>
            </header>
            <h2>{job.title}</h2>
            <p>{job.description}</p>
            <div className="job-card-meta">
              <span>{job.location}</span>
              <span>{job.employmentType}</span>
              <span>{job.salary}</span>
            </div>
            <div className="job-card-keywords">
              {job.keywords.slice(0, 4).map((keyword) => (
                <span key={keyword}>{keyword}</span>
              ))}
            </div>
            <footer>
              {job.mockInterviewEnabled ? (
                <span className="mock-interview-label">
                  ✦ Mock interview available
                </span>
              ) : (
                <span />
              )}
              <Link href={`/jobs/${job.id}`} className="btn btn-primary">
                View role
              </Link>
            </footer>
          </article>
        ))}
      </div>
      {visibleJobs.length === 0 && (
        <div className="panel empty-state">
          <h3>No matching roles</h3>
          <p>Try a broader search or include all recommendations.</p>
        </div>
      )}
    </div>
    </div>
  );
}
