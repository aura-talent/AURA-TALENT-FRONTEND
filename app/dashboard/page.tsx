"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, type Application, type JobPosting } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { scoreColor } from "@/components/ScoreDial";
import { useAuth } from "@/components/AuthProvider";

const STALE_DAYS = 3;

function daysSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24);
}

function formatScannedAt(iso: string): string {
  const days = daysSince(iso);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  return `${Math.floor(days)} days ago`;
}

export default function Dashboard() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");

  const { user, loading: authLoading } = useAuth();
  const [resume, setResume] = useState<any | null>(null);
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const [searchTerms, setSearchTerms] = useState<string[]>([]);

  // Scan cache state
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [cacheLoading, setCacheLoading] = useState(false);
  const [scanLoading, setScanLoading] = useState(false);
  const [scanError, setScanError] = useState("");

  const [windowWidth, setWindowWidth] = useState(1200);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setWindowWidth(window.innerWidth);
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }
  }, []);

  const isDesktop = windowWidth > 960;

  useEffect(() => {
    api
      .listApplications()
      .then(setApps)
      .catch(() => setError("Could not load your tracker — is the backend running?"));
  }, []);

  // Load resume and extract search terms
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setHasResume(false);
      setResume(null);
      setJobs(null);
      setScannedAt(null);
      return;
    }

    api
      .getResume()
      .then((res) => {
        setResume(res);
        setHasResume(true);
        const profile = res.profile ?? {};
        const terms = [
          ...((profile.target_archetypes as string[]) || []),
          ...((profile.top_skills as string[]) || []),
        ].slice(0, 5);
        setSearchTerms(terms);
      })
      .catch(() => {
        setHasResume(false);
      });
  }, [user, authLoading]);

  // Load cached scan results from Supabase once resume is ready
  useEffect(() => {
    if (!user || hasResume !== true) return;

    setCacheLoading(true);
    setScanError("");

    const userId = user.id;

    async function loadCachedScan() {
      try {
        const { data } = await supabase
          .from("job_scans")
          .select("jobs, scanned_at")
          .eq("user_id", userId)
          .single();

        if (data) {
          setJobs(data.jobs as JobPosting[]);
          setScannedAt(data.scanned_at as string);
          // Auto-refresh silently if cache is stale
          if (daysSince(data.scanned_at as string) >= STALE_DAYS) {
            runScan(searchTerms, userId, true);
          }
        }
      } catch {
        // No cache found or query error, fallback to initial state
      } finally {
        setCacheLoading(false);
      }
    }

    loadCachedScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, hasResume]);

  const runScan = useCallback(
    async (terms: string[], userId: string, silent = false) => {
      if (terms.length === 0) return;
      if (!silent) setScanError("");
      setScanLoading(true);
      try {
        const res = await api.scan({ title_keywords: terms });
        const now = new Date().toISOString();
        await supabase.from("job_scans").upsert({
          user_id: userId,
          jobs: res.jobs,
          scanned_at: now,
        });
        setJobs(res.jobs);
        setScannedAt(now);
      } catch {
        if (!silent) setScanError("Scan failed — check your connection and try again.");
      } finally {
        setScanLoading(false);
      }
    },
    []
  );

  function handleStartScan() {
    if (!user) return;
    runScan(searchTerms, user.id);
  }

  const hasNoCache = !cacheLoading && !jobs && !scanLoading;
  const showJobs = jobs && jobs.length > 0;

  return (
    <div className="container" style={{ paddingBottom: "4rem" }}>
      <div className="page-head">
        <h1>Your pipeline</h1>
        <p>Every job you&apos;ve evaluated, in one place. Update statuses as you hear back.</p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isDesktop ? "1.9fr 1.1fr" : "1fr",
          gap: "2rem",
          alignItems: "start",
        }}
      >
        {/* Left Column: Pipeline Table */}
        <div style={{ minWidth: 0 }}>
          {apps && apps.length === 0 && (
            <div className="panel" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
              <h3 style={{ marginBottom: "0.6rem" }}>No evaluations yet</h3>
              <p style={{ color: "var(--ink-72)", marginBottom: "1.5rem" }}>
                Paste your first job link and see where you stand.
              </p>
              <Link href="/evaluate" className="btn btn-primary text-white">
                Evaluate a job
              </Link>
            </div>
          )}

          {apps && apps.length > 0 && (
            <div className="panel" style={{ padding: "0.5rem", overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Company</th>
                    <th>Role</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => (
                    <tr
                      key={a.evaluation_id}
                      onClick={() => router.push(`/report/${a.evaluation_id}`)}
                      style={{ cursor: "pointer" }}
                    >
                      <td className="mono">{a.date}</td>
                      <td style={{ fontWeight: 600 }}>{a.company}</td>
                      <td>{a.role}</td>
                      <td>
                        <span className="score-pill" style={{ background: scoreColor(a.score) }}>
                          {a.score.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!apps && !error && (
            <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
              <p style={{ color: "var(--ink-55)" }}>Loading your pipeline…</p>
            </div>
          )}
        </div>

        {/* Right Column: Suited Jobs */}
        <div style={{ minWidth: 0 }}>
          <div className="panel" style={{ position: "relative", overflow: "hidden" }}>
            <div className="aura-glow" style={{ opacity: 0.15, transform: "scale(0.8)" }} />
            <h3
              style={{ fontSize: "1.2rem", marginBottom: "0.5rem", position: "relative", zIndex: 1 }}
            >
              Suited jobs for you
            </h3>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--ink-55)",
                marginBottom: "1.25rem",
                position: "relative",
                zIndex: 1,
              }}
            >
              Aura matches open roles on company portals against your resume target roles and skills.
            </p>

            {authLoading && (
              <p style={{ fontSize: "0.875rem", color: "var(--ink-55)", position: "relative", zIndex: 1 }}>
                Checking auth session...
              </p>
            )}

            {/* Not logged in */}
            {!authLoading && !user && (
              <div
                style={{
                  background: "rgba(78, 63, 216, 0.03)",
                  border: "1.5px dashed var(--iris-12)",
                  borderRadius: "var(--r-s)",
                  padding: "1.25rem",
                  textAlign: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Unlock Recommendations
                </h4>
                <p style={{ fontSize: "0.8125rem", color: "var(--ink-72)", marginBottom: "1rem" }}>
                  Sign in and upload your resume to see matching jobs.
                </p>
                <Link
                  href="/login?redirect=/dashboard"
                  className="btn btn-primary text-white"
                  style={{ padding: "0.45rem 1rem", fontSize: "0.84rem", width: "100%", justifyContent: "center" }}
                >
                  Sign in
                </Link>
              </div>
            )}

            {/* Logged in but no resume */}
            {!authLoading && user && hasResume === false && (
              <div
                style={{
                  background: "rgba(185, 125, 20, 0.03)",
                  border: "1.5px dashed rgba(185, 125, 20, 0.2)",
                  borderRadius: "var(--r-s)",
                  padding: "1.25rem",
                  textAlign: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <h4 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.35rem" }}>
                  Upload your resume
                </h4>
                <p style={{ fontSize: "0.8125rem", color: "var(--ink-72)", marginBottom: "1rem" }}>
                  Aura needs your resume to extract search keywords.
                </p>
                <Link
                  href="/onboarding"
                  className="btn btn-primary text-white"
                  style={{ padding: "0.45rem 1rem", fontSize: "0.84rem", width: "100%", justifyContent: "center" }}
                >
                  Get started
                </Link>
              </div>
            )}

            {/* Logged in with resume */}
            {!authLoading && user && hasResume === true && (
              <div style={{ position: "relative", zIndex: 1 }}>
                {resume && (
                  <div style={{ marginBottom: "1rem", fontSize: "0.8125rem", color: "var(--ink-55)" }}>
                    Profile: <strong>{resume.profile?.headline || "Your Resume"}</strong>
                  </div>
                )}

                {/* Cache loading */}
                {cacheLoading && (
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-55)" }}>Loading job matches…</p>
                )}

                {/* No cache yet — prompt user to start */}
                {hasNoCache && (
                  <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
                    <p style={{ fontSize: "0.8125rem", color: "var(--ink-55)", marginBottom: "1rem" }}>
                      Find open roles that match your profile across company portals.
                    </p>
                    <button
                      className="btn btn-primary text-white"
                      style={{ padding: "0.5rem 1.5rem", fontSize: "0.875rem" }}
                      onClick={handleStartScan}
                    >
                      Start job search
                    </button>
                  </div>
                )}

                {/* Scanning with no previous results */}
                {scanLoading && !jobs && (
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-55)" }}>
                    Scanning company portals…
                  </p>
                )}

                {scanError && (
                  <div
                    className="notice notice-error"
                    style={{ padding: "0.6rem 0.8rem", fontSize: "0.8rem", marginBottom: "0.75rem" }}
                  >
                    {scanError}
                  </div>
                )}

                {/* Job results */}
                {showJobs && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                    {jobs!.slice(0, 6).map((job) => (
                      <div
                        key={job.url}
                        style={{
                          padding: "0.75rem",
                          border: "1px solid var(--ink-06)",
                          borderRadius: "var(--r-s)",
                          background: "var(--surface)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={job.title}
                        >
                          {job.title}
                        </div>
                        <div
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--ink-55)",
                            display: "flex",
                            justifyContent: "space-between",
                            margin: "0.2rem 0",
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>{job.company}</span>
                          <span>{job.location}</span>
                        </div>
                        <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                          <a
                            href={job.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-ghost"
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.75rem",
                              flex: 1,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            View
                          </a>
                          <Link
                            href={`/evaluate?url=${encodeURIComponent(job.url)}`}
                            className="btn btn-primary text-white"
                            style={{
                              padding: "0.3rem 0.75rem",
                              fontSize: "0.75rem",
                              flex: 1,
                              display: "flex",
                              justifyContent: "center",
                            }}
                          >
                            Score Fit
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!scanLoading && jobs && jobs.length === 0 && (
                  <p style={{ fontSize: "0.875rem", color: "var(--ink-55)" }}>
                    No matching openings found. Try updating your target archetypes in the resume.
                  </p>
                )}

                {/* Footer: last scanned + refresh */}
                {scannedAt && (
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-40)" }}>
                      {scanLoading ? "Refreshing…" : `Last scanned ${formatScannedAt(scannedAt)}`}
                    </span>
                    {!scanLoading && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
                        onClick={handleStartScan}
                      >
                        Refresh
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
