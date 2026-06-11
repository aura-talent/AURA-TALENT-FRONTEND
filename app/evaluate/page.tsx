"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Evaluation } from "@/lib/api";
import { useStream } from "@/lib/useStream";
import ScoreDial, { scoreColor } from "@/components/ScoreDial";
import StreamProgress from "@/components/StreamProgress";
import ReportView from "@/components/ReportView";

const BAR_LABELS: Record<string, string> = {
  match_cv: "Resume match",
  alignment: "Career fit",
  comp: "Compensation",
  culture: "Culture",
  red_flags: "Red flags",
};

const EVALUATION_FALLBACK_LINES = [
  "Reading the job description...",
  "Matching requirements against your resume...",
  "Sizing up level and compensation...",
  "Checking whether the posting is real...",
  "Writing your report...",
];

function tierChip(tier: string) {
  if (tier.startsWith("High")) return "chip chip-tier-high";
  if (tier.startsWith("Suspicious")) return "chip chip-tier-sus";
  return "chip chip-tier-caution";
}

function EvaluateInner() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"url" | "text">("url");
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [text, setText] = useState("");
  const [hasResume, setHasResume] = useState<boolean | null>(null);
  const {
    run: streamEvaluate,
    reset: resetEvaluation,
    progress,
    result,
    error,
    loading,
  } = useStream<Evaluation, { jd_text?: string; jd_url?: string }>(
    "jobs/evaluate/stream"
  );

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
    api.getResume().then(() => setHasResume(true)).catch(() => setHasResume(false));
  }, []);

  function run() {
    const input = mode === "url" ? { jd_url: url.trim() } : { jd_text: text };
    void streamEvaluate(input);
  }

  if (loading) {
    return (
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="page-head"><h1>Evaluating</h1></div>
        <div className="panel">
          <StreamProgress
            title="Evaluation agent"
            progress={progress}
            fallbackLines={EVALUATION_FALLBACK_LINES}
          />
        </div>
        {error && <div className="notice notice-error" style={{ marginTop: "1rem" }}>{error}</div>}
      </div>
    );
  }

  if (result) {
    return (
      <div className="container" style={{ maxWidth: "var(--maxw)", paddingBottom: "4rem" }}>
        <div className="page-head">
          <h1>{result.company} — {result.role}</h1>
          <p>{result.archetype}</p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isDesktop ? "3fr 7fr" : "1fr",
            gap: "2rem",
            alignItems: "start",
          }}
        >
          {/* Left Column: Metrics & Recommendations */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", position: isDesktop ? "sticky" : "static", top: "6.5rem" }}>
            <div className="panel" style={{ position: "relative", overflow: "hidden" }}>
              <div className="aura-glow" style={{ opacity: 0.35 }} />
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: "1.5rem", alignItems: "center" }}>
                <ScoreDial score={result.score} />
                <div style={{ width: "100%" }}>
                  <div className="bars">
                    {Object.entries(BAR_LABELS).map(([key, label]) => {
                      const v = result.scores[key as keyof typeof result.scores];
                      return (
                        <div className="bar-row" key={key}>
                          <span className="bar-label">{label}</span>
                          <div className="bar-track">
                            <div className="bar-fill" style={{ width: `${(v / 5) * 100}%`, background: scoreColor(v) }} />
                          </div>
                          <span className="bar-num">{v.toFixed(1)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div style={{ position: "relative", marginTop: "1.5rem", borderTop: "1px solid var(--ink-06)", paddingTop: "1.25rem" }}>
                <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                  <span className={tierChip(result.legitimacy.tier)}>
                    {result.legitimacy.tier}
                  </span>
                </div>
                <p style={{ fontWeight: 600, fontSize: "0.95rem", lineHeight: "1.5" }}>{result.recommendation}</p>
              </div>
              {result.score < 3.5 && (
                <div className="notice notice-warn" style={{ marginTop: "1.25rem", marginBottom: 0 }}>
                  This score is below 3.5 — Aura recommends skipping this one
                  unless you have a specific reason. Your time is worth more.
                </div>
              )}
            </div>

            <div className="hero-ctas" style={{ gap: "0.75rem" }}>
              <button className="btn btn-primary text-white" onClick={resetEvaluation}>
                Evaluate another job
              </button>
              <Link href="/dashboard" className="btn btn-ghost">View tracker</Link>
            </div>
          </div>

          {/* Right Column: Detailed Markdown Report */}
          <div className="panel" style={{ minWidth: 0, maxHeight: isDesktop ? "calc(100vh - 12rem)" : "none", overflowY: isDesktop ? "auto" : "visible" }}>
            <ReportView markdown={result.report_markdown} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 760, paddingBottom: "4rem" }}>
      <div className="page-head">
        <h1>Evaluate a job</h1>
        <p>Paste a job link or the description itself. Aura scores your fit and writes the full report — about a minute.</p>
      </div>

      {hasResume === false && (
        <div className="notice notice-warn">
          No resume on file yet — <Link href="/onboarding" style={{ fontWeight: 600 }}>add yours first</Link> so Aura has something to match against.
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      <div className="panel">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={mode === "url"} onClick={() => setMode("url")}>
            Job link
          </button>
          <button className="tab" role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")}>
            Paste description
          </button>
        </div>

        {mode === "url" ? (
          <div className="field">
            <label htmlFor="jd-url">Job posting URL</label>
            <input
              id="jd-url"
              className="input"
              type="url"
              placeholder="https://job-boards.greenhouse.io/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
        ) : (
          <div className="field">
            <label htmlFor="jd-text">Job description</label>
            <textarea
              id="jd-text"
              className="input"
              placeholder="Paste the full job description here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
        )}

        <button
          className="btn btn-primary"
          disabled={hasResume === false || (mode === "url" ? !url.trim().startsWith("http") : text.trim().length < 200)}
          onClick={run}
        >
          Score this job
        </button>
      </div>
    </div>
  );
}

export default function EvaluatePage() {
  return (
    <Suspense>
      <EvaluateInner />
    </Suspense>
  );
}
