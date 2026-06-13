"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, type Application, type JobPosting } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { scoreColor } from "@/components/ScoreDial";
import { useAuth } from "@/components/AuthProvider";
import CareerPathNavigator from "@/components/CareerPathNavigator";

function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "";
    
    if (tz.includes("Kuala_Lumpur")) return "Malaysia";
    if (tz.includes("Singapore")) return "Singapore";
    if (tz.includes("London") || tz.includes("Europe/London") || tz.includes("GB")) return "United Kingdom";
    if (tz.includes("America/") || tz.includes("US/")) return "United States";
    if (tz.includes("Europe/Berlin")) return "Germany";
    if (tz.includes("Europe/Paris")) return "France";
    if (tz.includes("Asia/Tokyo")) return "Japan";
    if (tz.includes("Australia/")) return "Australia";
    if (tz.includes("Asia/Seoul")) return "South Korea";
    if (tz.includes("Asia/Hong_Kong")) return "Hong Kong";
    if (tz.includes("Asia/Shanghai") || tz.includes("Asia/Taipei")) return "Taiwan";
    if (tz.includes("Asia/Jakarta")) return "Indonesia";
    if (tz.includes("Asia/Manila")) return "Philippines";
    if (tz.includes("Asia/Bangkok")) return "Thailand";
    if (tz.includes("Asia/Ho_Chi_Minh")) return "Vietnam";
    if (tz.includes("Asia/Kolkata")) return "India";
    
    const parts = tz.split("/");
    if (parts.length > 1) {
      return parts[1].replace(/_/g, " ");
    }
  } catch (e) {
    // Ignore error
  }
  return "";
}

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

/* dashed calibration-ring spinner + mono readout, for the panel's
   late-arriving states (auth, cached scan, live scan) */
function ScanStatus({ label }: { label: string }) {
  return (
    <div className="scan-status">
      <span className="scan-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
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
  const [locationInput, setLocationInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("aura_location_filter");
    if (saved !== null) {
      setLocationInput(saved);
    } else {
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              const res = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
              );
              if (res.ok) {
                const data = await res.json();
                const city = data.city || data.locality || data.principalSubdivision || "";
                if (city) {
                  const val = `${city}, Remote`;
                  setLocationInput(val);
                  localStorage.setItem("aura_location_filter", val);
                  return;
                }
              }
            } catch (e) {
              console.error("Geocoding lookup failed:", e);
            }
            const guessed = guessCountry();
            const fallback = guessed ? `${guessed}, Remote` : "Remote";
            setLocationInput(fallback);
          },
          (err) => {
            console.warn("Geolocation permission denied or failed:", err);
            const guessed = guessCountry();
            const fallback = guessed ? `${guessed}, Remote` : "Remote";
            setLocationInput(fallback);
          }
        );
      } else {
        const guessed = guessCountry();
        const fallback = guessed ? `${guessed}, Remote` : "Remote";
        setLocationInput(fallback);
      }
    }
  }, []);

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
    if (authLoading) return;
    api
      .listApplications()
      .then(setApps)
      .catch(() => setError("Could not load your tracker — is the backend running?"));
  }, [user, authLoading]);

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
            const saved = localStorage.getItem("aura_location_filter");
            const locStr = saved !== null ? saved : (guessCountry() ? `${guessCountry()}, Remote` : "Remote");
            runScan(searchTerms, userId, locStr, true);
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
    async (terms: string[], userId: string, locsStr: string, silent = false) => {
      if (terms.length === 0) return;
      if (!silent) setScanError("");
      setScanLoading(true);
      try {
        const locs = locsStr.split(",").map((s) => s.trim()).filter(Boolean);
        const res = await api.scan({
          title_keywords: terms,
          ...(locs.length ? { location_keywords: locs } : {}),
        });
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
    runScan(searchTerms, user.id, locationInput);
  }

  /* entrance: title block prints, then the two columns rise */
  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.65 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 }).from(
        q(".dash-col"),
        { y: 28, autoAlpha: 0, stagger: 0.15, duration: 0.7 },
        "-=0.35"
      );
    });
    return () => mm.revert();
  }, []);

  /* pipeline rows file in from the left margin once they load */
  useEffect(() => {
    if (!apps?.length) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q(".table tbody tr"), {
        x: -18,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.05,
      });
    });
    return () => mm.revert();
  }, [apps]);

  /* scan results stamp in as each batch arrives */
  useEffect(() => {
    if (!jobs?.length) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.from(q(".dash-job"), {
        y: 14,
        autoAlpha: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.07,
      });
    });
    return () => mm.revert();
  }, [jobs]);

  const hasNoCache = !cacheLoading && !jobs && !scanLoading;
  const showJobs = jobs && jobs.length > 0;

  return (
    <div className="app-sheet" ref={root}>
    <div className="container" style={{ paddingBottom: "4rem" }}>
      <div className="page-head">
        <div className="page-kicker">(01) // PIPELINE</div>
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
        <div className="dash-col" style={{ minWidth: 0 }}>
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
        <div className="dash-col" style={{ minWidth: 0 }}>
          <div className="panel">
            <span className="eval-tick eval-tick-tl" />
            <span className="eval-tick eval-tick-tr" />
            <span className="eval-tick eval-tick-bl" />
            <span className="eval-tick eval-tick-br" />
            <div className="page-kicker" style={{ marginBottom: "0.6rem" }}>
              LIVE_SCAN // PORTALS
            </div>
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

            {authLoading && <ScanStatus label="AUTH_CHECK // RUNNING" />}

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
                  <div style={{ marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--ink-55)" }}>
                    Profile: <strong>{resume.profile?.headline || "Your Resume"}</strong>
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "flex-end" }}>
                  <div className="field" style={{ margin: 0, flex: 1 }}>
                    <label htmlFor="dashboard-loc" style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-55)", marginBottom: "0.25rem" }}>
                      Target Locations
                    </label>
                    <input
                      id="dashboard-loc"
                      className="input"
                      style={{ padding: "0.35rem 0.6rem", fontSize: "0.8125rem", height: "32px" }}
                      placeholder="Malaysia, Remote, Singapore"
                      value={locationInput}
                      onChange={(e) => {
                        setLocationInput(e.target.value);
                        localStorage.setItem("aura_location_filter", e.target.value);
                      }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ height: "32px", padding: "0 0.75rem", fontSize: "0.8125rem" }}
                    onClick={handleStartScan}
                    disabled={scanLoading}
                  >
                    {scanLoading ? "Scanning…" : "Scan"}
                  </button>
                </div>

                {/* Cache loading */}
                {cacheLoading && <ScanStatus label="CACHE_FETCH // RUNNING" />}

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
                  <ScanStatus label="PORTAL_SCAN // RUNNING" />
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
                        className="dash-job"
                        style={{
                          padding: "0.75rem",
                          border: "1px solid var(--ink-30)",
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
                    {scanLoading ? (
                      <ScanStatus label="REFRESH // RUNNING" />
                    ) : (
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-40)" }}>
                        {`Last scanned ${formatScannedAt(scannedAt)}`}
                      </span>
                    )}
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

      {!authLoading && user && hasResume === true && <CareerPathNavigator />}
    </div>
    </div>
  );
}