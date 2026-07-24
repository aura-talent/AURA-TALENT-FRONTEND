"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, type Application, type JobPosting } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/components/AuthProvider";
import CareerPathNavigator from "@/components/CareerPathNavigator";
import AnimalEmblem from "@/components/dashboard/AnimalEmblem";
import {
  bountyApi,
  formatPrize,
  totalPrizePool,
  type Bounty,
  type CandidateBountyHistory,
} from "@/lib/bountyApi";


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

  // Bounty states
  const [recentBounties, setRecentBounties] = useState<Bounty[]>([]);
  const [mySubmissions, setMySubmissions] = useState<CandidateBountyHistory[]>([]);
  const [bountyTab, setBountyTab] = useState<"recent" | "submitted">("recent");
  const [bountyLoading, setBountyLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .listPublished()
      .then((data) => {
        if (!cancelled) setRecentBounties(data.slice(0, 3));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setBountyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    bountyApi
      .listCandidateHistory(user.id)
      .then((data) => {
        if (!cancelled) setMySubmissions(data.slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);


  const refreshApplications = useCallback(() => {
    if (authLoading || !user) return;
    api
      .listApplications()
      .then(setApps)
      .catch(() => setError("Could not load your tracker data."));
  }, [authLoading, user]);

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
            localStorage.setItem("aura_location_filter", fallback);
          },
          (err) => {
            console.warn("Geolocation permission denied or failed:", err);
            const guessed = guessCountry();
            const fallback = guessed ? `${guessed}, Remote` : "Remote";
            setLocationInput(fallback);
            localStorage.setItem("aura_location_filter", fallback);
          }
        );
      } else {
        const guessed = guessCountry();
        const fallback = guessed ? `${guessed}, Remote` : "Remote";
        setLocationInput(fallback);
        localStorage.setItem("aura_location_filter", fallback);
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
    refreshApplications();
  }, [user, authLoading, refreshApplications]);

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

  // Entrance animations
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

  // Job recommendations fade-in animation
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

  // Statistics Computations
  const totalApps = apps?.length ?? 0;
  
  const offersCount = apps?.filter((a) => a.status === "Offer").length ?? 0;
  
  const responseCount = apps?.filter((a) => 
    !["Saved", "Applied"].includes(a.status)
  ).length ?? 0;

  const interviewRoundsCount = apps?.reduce((acc, app) => 
    acc + (app.interviews?.length ?? 0), 0
  ) ?? 0;

  const responseRate = totalApps > 0 
    ? ((responseCount / totalApps) * 100).toFixed(0) 
    : "0";
    
  const offerRate = totalApps > 0 
    ? ((offersCount / totalApps) * 100).toFixed(0) 
    : "0";

  // Upcoming Interviews extraction
  const upcomingInterviews = (apps || [])
    .flatMap((app) => 
      (app.interviews || []).map((int) => ({
        ...int,
        company: app.company,
        role: app.role,
        appId: app.id
      }))
    )
    .filter((int) => {
      const today = new Date();
      today.setHours(0,0,0,0);
      return new Date(int.date) >= today;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  // Status breakdown details
  const statusCounts: Record<string, number> = {};
  (apps || []).forEach((app) => {
    statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
  });

  // Calculate monthly activity labels
  const monthlyCounts: Record<string, number> = {};
  (apps || []).forEach((app) => {
    if (app.date) {
      const parts = app.date.split("-");
      if (parts.length >= 2) {
        const monthLabel = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1).toLocaleString("en-US", { month: "short", year: "2-digit" });
        monthlyCounts[monthLabel] = (monthlyCounts[monthLabel] || 0) + 1;
      }
    }
  });

  const monthsList = Object.keys(monthlyCounts).slice(-6); // last 6 months
  const maxMonthValue = Math.max(...Object.values(monthlyCounts), 1);

  const hasNoCache = !cacheLoading && !jobs && !scanLoading;
  const showJobs = jobs && jobs.length > 0;

  return (
    <div className="dashboard-page app-sheet" ref={root}>
      <div className="container" style={{ paddingBottom: "5rem" }}>
        
        {/* Page Head */}
        <div className="page-head">
          <div className="page-kicker">(01) // CONTROL_CENTER</div>
          <h1>Candidate Dashboard</h1>
          <p>Analyze response rates, view scheduled rounds, and review matches from company portals.</p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "1.8fr 1.2fr" : "1fr",
            gap: "2.5rem",
            alignItems: "start",
          }}
        >
          {/* LEFT COLUMN: Statistics, Charts, Reminders */}
          <div className="dash-col" style={{ display: "flex", flexDirection: "column", gap: "2rem", minWidth: 0 }}>
            
            {/* KPI Scorecards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "1rem" }}>
              
              {/* Total Apps */}
              <div className="panel" style={{ padding: "1.25rem", position: "relative" }}>
                <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-space), monospace", color: "var(--ink-55)", display: "block" }}>
                  TOTAL_APPLICATIONS
                </span>
                <span style={{ fontSize: "2rem", fontWeight: 700, display: "block", margin: "0.25rem 0" }} className="mono">
                  {totalApps}
                </span>
                <Link href="/tracker" style={{ fontSize: "0.75rem", fontWeight: 600 }} className="auth-legal-link">
                  Open tracker →
                </Link>
              </div>

              {/* Response Rate */}
              <div className="panel" style={{ padding: "1.25rem" }}>
                <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-space), monospace", color: "var(--ink-55)", display: "block" }}>
                  RESPONSE_RATE
                </span>
                <span style={{ fontSize: "2rem", fontWeight: 700, display: "block", margin: "0.25rem 0" }} className="mono">
                  {responseRate}%
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-55)" }}>
                  {responseCount} of {totalApps} progressed
                </span>
              </div>

              {/* Scheduled Rounds */}
              <div className="panel" style={{ padding: "1.25rem" }}>
                <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-space), monospace", color: "var(--ink-55)", display: "block" }}>
                  INTERVIEW_ROUNDS
                </span>
                <span style={{ fontSize: "2rem", fontWeight: 700, display: "block", margin: "0.25rem 0" }} className="mono">
                  {interviewRoundsCount}
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-55)" }}>
                  Active scheduled dates
                </span>
              </div>

              {/* Offer Conversion */}
              <div className="panel" style={{ padding: "1.25rem" }}>
                <span style={{ fontSize: "0.65rem", fontFamily: "var(--font-space), monospace", color: "var(--ink-55)", display: "block" }}>
                  OFFER_CONVERSION
                </span>
                <span style={{ fontSize: "2rem", fontWeight: 700, display: "block", margin: "0.25rem 0" }} className="mono">
                  {offerRate}%
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-55)" }}>
                  {offersCount} accepted offers
                </span>
              </div>
            </div>

            {/* Analytics Section */}
            <div className="panel" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1.25rem", fontFamily: "var(--font-space), monospace" }}>
                PIPELINE_ANALYTICS // VISUALIZATION
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "1fr 1fr" : "1fr", gap: "2rem" }}>
                
                {/* Monthly Activity CSS Bar Chart */}
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "1rem" }}>
                    MONTHLY APPLICATION COUNTS
                  </span>
                  
                  {monthsList.length > 0 ? (
                    <div style={{ display: "flex", gap: "1rem", height: "140px", alignItems: "flex-end", paddingBottom: "0.5rem", borderBottom: "1px solid var(--ink-12)" }}>
                      {monthsList.map((month) => {
                        const count = monthlyCounts[month] || 0;
                        const pct = (count / maxMonthValue) * 100;
                        return (
                          <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                            <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ink-72)" }}>{count}</span>
                            <div style={{ width: "100%", height: `${pct}%`, background: "var(--iris)", borderRadius: "2px", minHeight: "4px" }} />
                            <span style={{ fontSize: "0.62rem", color: "var(--ink-55)", whiteSpace: "nowrap" }}>{month}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ height: "140px", display: "grid", placeItems: "center", border: "1px dashed var(--ink-12)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-40)" }}>No application dates found yet</span>
                    </div>
                  )}
                </div>

                {/* Status breakdown distribution bars */}
                <div>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "1rem" }}>
                    PIPELINE STATUS DISTRIBUTION
                  </span>
                  
                  {totalApps > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {Object.entries(statusCounts).map(([status, count]) => {
                        const pct = ((count / totalApps) * 100).toFixed(0);
                        return (
                          <div key={status}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", marginBottom: "0.15rem" }}>
                              <span style={{ fontWeight: 600 }}>{status}</span>
                              <span style={{ color: "var(--ink-55)" }}>{count} ({pct}%)</span>
                            </div>
                            <div style={{ width: "100%", height: "6px", background: "var(--ink-12)", borderRadius: "3px" }}>
                              <div style={{ width: `${pct}%`, height: "6px", background: "var(--ink-72)", borderRadius: "3px" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ height: "140px", display: "grid", placeItems: "center", border: "1px dashed var(--ink-12)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-40)" }}>No applications available</span>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Career Path Navigator */}
            {!authLoading && user && hasResume === true && (
              <>
                <Link
                  href="/career-map"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    gap: "1rem", padding: "1rem 1.2rem", marginBottom: "1rem",
                    borderRadius: "var(--r-m, 12px)", textDecoration: "none",
                    background: "linear-gradient(120deg, #10132a, #1c1440)",
                    border: "1px solid rgba(143,125,255,0.35)", color: "#fafaf8",
                  }}
                >
                  <span style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <span style={{ fontWeight: 700 }}>Career Map</span>
                    <span style={{ fontSize: "0.8rem", color: "rgba(250,250,248,0.6)" }}>
                      Explore your next roles, pivots, and wildcards in 3D
                    </span>
                  </span>
                  <span className="mono" style={{ fontSize: "0.75rem", color: "#c7b9ff", whiteSpace: "nowrap" }}>
                    Open map →
                  </span>
                </Link>
                <CareerPathNavigator />
              </>
            )}

            {/* Upcoming Interviews Reminder Checklist */}
            <div className="panel" style={{ padding: "1.5rem" }}>
              <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "1rem", fontFamily: "var(--font-space), monospace" }}>
                UPCOMING_INTERVIEW_ROUND_NOTIFICATIONS
              </h3>

              {upcomingInterviews.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {upcomingInterviews.map((int) => (
                    <div 
                      key={int.id} 
                      className="panel" 
                      style={{ 
                        padding: "0.85rem", 
                        background: "rgba(78, 63, 216, 0.02)", 
                        border: "1px solid var(--iris-12)", 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center" 
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.68rem", textTransform: "uppercase", fontWeight: 700, color: "var(--iris)" }}>
                          {int.company}
                        </span>
                        <h4 style={{ fontSize: "0.85rem", fontWeight: 600, margin: "0.1rem 0" }}>
                          {int.name} // {int.role}
                        </h4>
                        {int.interviewer && (
                          <span style={{ fontSize: "0.72rem", color: "var(--ink-55)", display: "block" }}>
                            Interviewer: {int.interviewer}
                          </span>
                        )}
                      </div>
                      
                      <div style={{ textAlign: "right" }}>
                        <span className="mono" style={{ fontSize: "0.8rem", fontWeight: 700, display: "block", color: "var(--ink)" }}>
                          {int.date}
                        </span>
                        <Link 
                          href="/tracker" 
                          style={{ fontSize: "0.7rem", fontWeight: 600, display: "inline-block", marginTop: "0.25rem" }} 
                          className="auth-legal-link"
                        >
                          View round checklist →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "2rem", border: "1.5px dashed var(--ink-12)", borderRadius: "var(--r-s)" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--ink-55)", margin: 0 }}>
                    No upcoming interview dates scheduled.
                  </p>
                  <Link href="/tracker" style={{ fontSize: "0.75rem", fontWeight: 600, marginTop: "0.5rem", display: "inline-block" }} className="auth-legal-link">
                    Open scheduler tool →
                  </Link>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Work animal, company portals matches & keyword scans */}
          <div className="dash-col" style={{ minWidth: 0 }}>
            {/* Work Animal — cursor-following porcelain emblem */}
            <div className="panel" style={{ padding: "1.75rem 1.5rem", marginBottom: "1.5rem" }}>
              <div className="page-kicker" style={{ marginBottom: "1.25rem" }}>
                WORK_ANIMAL // WHO ARE YOU AT WORK
              </div>
              <div style={{ display: "flex", justifyContent: "center" }}>
                <AnimalEmblem />
              </div>
            </div>

            <div className="panel">
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />

              <div className="page-kicker" style={{ marginBottom: "0.6rem" }}>
                LIVE_SCAN // PORTALS
              </div>
              <h3 style={{ fontSize: "1.15rem", marginBottom: "0.5rem" }}>
                Suited jobs for you
              </h3>
              <p style={{ fontSize: "0.82rem", color: "var(--ink-55)", marginBottom: "1.25rem" }}>
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
                <div>
                  {resume && (
                    <div style={{ marginBottom: "0.75rem", fontSize: "0.8125rem", color: "var(--ink-55)" }}>
                      Profile: <strong>{resume.profile?.headline || "Your Resume"}</strong>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", alignItems: "flex-end" }}>
                    <div className="field" style={{ margin: 0, flex: 1 }}>
                      <label htmlFor="dashboard-loc-loc" style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-55)", marginBottom: "0.25rem" }}>
                        Target Locations
                      </label>
                      <input
                        id="dashboard-loc-loc"
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

                  {cacheLoading && <ScanStatus label="CACHE_FETCH // RUNNING" />}

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


            {/* Paid Bounties Panel */}
            <div className="panel" style={{ marginTop: "2rem" }}>
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                <div>
                  <div className="page-kicker" style={{ marginBottom: "0.2rem" }}>
                    PAID_WORK // BOUNTIES
                  </div>
                  <h3 style={{ fontSize: "1.15rem", margin: 0, fontWeight: 700 }}>
                    Job Bounties
                  </h3>
                </div>
                <Link href="/bounties" style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--iris)", textDecoration: "none" }}>
                  View all →
                </Link>
              </div>

              <p style={{ fontSize: "0.82rem", color: "var(--ink-55)", marginBottom: "1rem" }}>
                Complete real tasks from hiring companies to win cash prizes and prove your skills.
              </p>

              {/* Sub-tabs: Recent vs Submitted */}
              <div style={{ display: "flex", gap: "0.4rem", marginBottom: "1rem", borderBottom: "1px solid var(--ink-10)" }}>
                <button
                  type="button"
                  onClick={() => setBountyTab("recent")}
                  style={{
                    padding: "0.4rem 0.75rem",
                    border: "none",
                    borderBottom: bountyTab === "recent" ? "2px solid var(--iris)" : "2px solid transparent",
                    background: bountyTab === "recent" ? "var(--iris-08)" : "transparent",
                    color: bountyTab === "recent" ? "var(--iris)" : "var(--ink-70)",
                    fontFamily: "var(--font-space), monospace",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    borderRadius: "4px 4px 0 0",
                  }}
                >
                  Recent Bounties ({recentBounties.length})
                </button>
                <button
                  type="button"
                  onClick={() => setBountyTab("submitted")}
                  style={{
                    padding: "0.4rem 0.75rem",
                    border: "none",
                    borderBottom: bountyTab === "submitted" ? "2px solid var(--iris)" : "2px solid transparent",
                    background: bountyTab === "submitted" ? "var(--iris-08)" : "transparent",
                    color: bountyTab === "submitted" ? "var(--iris)" : "var(--ink-70)",
                    fontFamily: "var(--font-space), monospace",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    borderRadius: "4px 4px 0 0",
                  }}
                >
                  My Submissions ({mySubmissions.length})
                </button>
              </div>

              {bountyTab === "recent" ? (
                <div>
                  {bountyLoading ? (
                    <span style={{ fontSize: "0.8rem", color: "var(--ink-55)" }}>Loading bounties…</span>
                  ) : recentBounties.length === 0 ? (
                    <p style={{ fontSize: "0.82rem", color: "var(--ink-55)" }}>No active bounties right now.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {recentBounties.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            padding: "0.75rem",
                            border: "1px solid var(--ink-12)",
                            background: "var(--surface)",
                            borderRadius: "6px",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {b.title}
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "var(--ink-55)", marginTop: "0.15rem" }}>
                              {formatPrize(totalPrizePool(b.winner_slots), b.currency)} pool · {b.winner_slots.length} winners
                            </div>
                          </div>
                          <Link href={`/bounties/${b.id}`} className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                            View →
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!user ? (
                    <p style={{ fontSize: "0.82rem", color: "var(--ink-55)" }}>Sign in to view your submissions.</p>
                  ) : mySubmissions.length === 0 ? (
                    <p style={{ fontSize: "0.82rem", color: "var(--ink-55)" }}>You haven&apos;t entered any bounties yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {mySubmissions.map((s) => {
                        const isWinner = s.result?.status === "winner";
                        return (
                          <div
                            key={s.submission.id}
                            style={{
                              padding: "0.75rem",
                              border: "1px solid var(--ink-12)",
                              background: "var(--surface)",
                              borderRadius: "6px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "0.75rem",
                            }}
                          >
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: "0.85rem", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {s.bounty.title}
                              </div>
                              <div style={{ fontSize: "0.72rem", color: "var(--ink-55)", marginTop: "0.15rem" }}>
                                {isWinner ? (
                                  <span style={{ color: "var(--score-strong)", fontWeight: 700 }}>🏆 Winner (Rank {s.result!.rank})</span>
                                ) : s.result?.status === "not_selected" ? (
                                  <span>Not selected</span>
                                ) : (
                                  <span style={{ color: "var(--iris)", fontWeight: 600 }}>⏳ Pending Review</span>
                                )}
                              </div>
                            </div>
                            <Link href={`/bounties/${s.bounty.id}`} className="btn btn-ghost" style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                              View →
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid var(--ink-10)", textAlign: "center" }}>
                <Link href="/bounties" className="btn btn-ghost" style={{ fontSize: "0.82rem", width: "100%", justifyContent: "center" }}>
                  Explore all open bounties →
                </Link>
              </div>
            </div>
          </div>


        </div>
      </div>
    </div>
  );
}