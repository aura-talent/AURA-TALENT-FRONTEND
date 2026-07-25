"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { CandidateJob } from "./mockJobs"; // or "@/types/job"
import QuickApplySheet, { type QuickApplyJob } from "@/components/jobs/QuickApplySheet";
import { api } from "@/lib/api";

const JOBS_PER_PAGE = 6;

export default function ExploreJobsPage() {
  const root = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [recommendedOnly, setRecommendedOnly] = useState(false);
  const [quickApplyJob, setQuickApplyJob] = useState<QuickApplyJob | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const [jobs, setJobs] = useState<CandidateJob[]>([]);

  useEffect(() => {
    api.listAllJobs().then((data) => {
      setJobs(data);
    });
  }, []);

  const visibleJobs = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    return jobs.filter((job) => {
      // 1. Status Filter
      if (job.status !== "Active") return false;

      // 2. Recommended Filter
      if (recommendedOnly && !job.recommended) return false;

      // 3. Query Filter
      if (!cleanQuery) return true;

      const searchTarget = [
        job.title,
        job.company_name ?? "",
        job.team ?? "",
        job.location ?? "",
        job.employment_type ?? "",
        ...(job.keywords || []),
      ]
        .join(" ")
        .toLowerCase();

      return searchTarget.includes(cleanQuery);
    });
  }, [jobs, query, recommendedOnly]);

  const totalPages = Math.max(1, Math.ceil(visibleJobs.length / JOBS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const firstJobIndex = (page - 1) * JOBS_PER_PAGE;
  const paginatedJobs = visibleJobs.slice(
    firstJobIndex,
    firstJobIndex + JOBS_PER_PAGE,
  );

  /* Entrance animation */
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
              <Link href="/tracker" className="back-link">
                ← Jobs
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
                onChange={(event) => {
                  setQuery(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search roles, skills, or teams"
              />
            </label>
            <label className="recommended-toggle">
              <input
                type="checkbox"
                checked={recommendedOnly}
                onChange={(event) => {
                  setRecommendedOnly(event.target.checked);
                  setCurrentPage(1);
                }}
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
            {paginatedJobs.map((job) => {
              const companyName = job.company_name || "Aura Partner";
              const formattedSalary =
                job.salary_low && job.salary_high
                  ? `${job.salary_currency === "USD" ? "$" : ""}${Math.round(
                      job.salary_low / 1000
                    )}k - $${Math.round(job.salary_high / 1000)}k`
                  : "Competitive";

              return (
                <article className="panel candidate-job-card" key={job.id}>
                  <header>
                    <div className="job-company-mark">{companyName[0]}</div>
                    <div>
                      <span>{companyName}</span>
                      <small>{job.team || "General Team"}</small>
                    </div>
                    <div className="job-match-badge">
                      <strong>{job.fit_score ?? 90}%</strong>
                      <span>match</span>
                    </div>
                  </header>
                  <h2>{job.title}</h2>
                  <p>{job.description}</p>
                  <div className="job-card-meta">
                    <span>{job.location || "Remote / On-site"}</span>
                    <span>{job.employment_type || "Full-time"}</span>
                    <span>{formattedSalary}</span>
                  </div>
                  <div className="job-card-keywords">
                    {job.keywords?.slice(0, 4).map((keyword: string) => (
                      <span key={keyword}>{keyword}</span>
                    ))}
                  </div>
                  <footer>
                    {job.mock_interview_enabled ? (
                      <span className="mock-interview-label">
                        ✦ Mock interview available
                      </span>
                    ) : (
                      <span />
                    )}
                    <div className="job-card-actions">
                      <button
                        className="btn btn-quick-apply"
                        onClick={() =>
                          setQuickApplyJob({
                            id: job.id,
                            title: job.title,
                            company: companyName,
                            team: job.team,
                            fit: job.fit_score ?? 90,
                            location: job.location,
                            employmentType: job.employment_type,
                            salary: formattedSalary,
                          })
                        }
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
              );
            })}
          </div>

          {visibleJobs.length > JOBS_PER_PAGE && (
            <nav className="jobs-pagination" aria-label="Job results pages">
              <span className="jobs-pagination-summary">
                Showing {firstJobIndex + 1}-{Math.min(firstJobIndex + JOBS_PER_PAGE, visibleJobs.length)} of {visibleJobs.length}
              </span>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setCurrentPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </button>
              <div className="jobs-pagination-pages">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  return (
                    <button
                      key={pageNumber}
                      className={pageNumber === page ? "active" : ""}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      aria-current={pageNumber === page ? "page" : undefined}
                      aria-label={`Page ${pageNumber}`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => setCurrentPage(page + 1)}
                disabled={page === totalPages}
              >
                Next
              </button>
            </nav>
          )}

          {visibleJobs.length === 0 && (
            <div className="panel empty-state">
              <h3>No matching roles</h3>
              <p>Try a broader search or include all recommendations.</p>
            </div>
          )}
        </div>
      </div>

      <QuickApplySheet
        job={quickApplyJob}
        onClose={() => setQuickApplyJob(null)}
      />
    </>
  );
}
