"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { jobs } from "./mockJobs";
import QuickApplySheet, { type QuickApplyJob } from "@/components/jobs/QuickApplySheet";

export default function ExploreJobsPage() {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [quickApplyJob, setQuickApplyJob] = useState<QuickApplyJob | null>(null);

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

  /* entrance: hero prints, toolbar lands, cards deal in */
  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.65 } });
      tl.from(q(".candidate-jobs-hero > div:first-child > *"), {
        y: 22,
        autoAlpha: 0,
        stagger: 0.1,
      })
        .from(q(".recommendation-summary"), { y: 22, autoAlpha: 0 }, "-=0.4")
        .from(q(".jobs-explore-toolbar"), { y: 20, autoAlpha: 0 }, "-=0.4")
        .from(q(".jobs-explore-head"), { autoAlpha: 0, duration: 0.5 }, "-=0.35")
        .from(
          q(".candidate-job-card"),
          { y: 26, autoAlpha: 0, duration: 0.55, stagger: { each: 0.07 } },
          "-=0.25"
        );
    });
    return () => mm.revert();
  }, []);

  return (
    <>
      <div className="app-sheet" ref={root}>
        <div className="container candidate-jobs-page">
          <div className="candidate-jobs-hero">
            <div>
              <Link href="/tracker" style={{ color: "var(--ink-55)", fontSize: "0.875rem", textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
                ← Back to tracker
              </Link>
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

          <div className="jobs-explore-toolbar panel" data-tour="jobs-search">
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
          <div className="candidate-job-grid" data-tour="jobs-grid">
            {visibleJobs.map((job) => (
              <article className="panel candidate-job-card" key={job.id}>
                <header>
                  <div className="job-company-mark">{job.company[0]}</div>
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
                  <div className="job-card-actions">
                    {/* Quick Apply — mobile-prominent, desktop-secondary */}
                    <button
                      className="btn btn-quick-apply"
                      onClick={() => setQuickApplyJob({
                        id: job.id,
                        title: job.title,
                        company: job.company,
                        team: job.team,
                        fit: job.fit,
                        location: job.location,
                        employmentType: job.employmentType,
                        salary: job.salary,
                      })}
                      aria-label={`Quick apply to ${job.title}`}
                    >
                      ⚡ Quick Apply
                    </button>
                    <Link href={`/jobs/${job.id}`} className="btn btn-primary">
                      View role
                    </Link>
                  </div>
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

      {/* Mobile Quick Apply bottom sheet */}
      <QuickApplySheet
        job={quickApplyJob}
        onClose={() => setQuickApplyJob(null)}
      />
    </>
  );
}

