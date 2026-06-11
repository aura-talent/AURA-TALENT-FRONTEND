"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Evaluation } from "@/lib/api";
import ReportView from "@/components/ReportView";
import ScoreDial, { scoreColor } from "@/components/ScoreDial";

const BAR_LABELS: Record<string, string> = {
  match_cv: "Resume match",
  alignment: "Career fit",
  comp: "Compensation",
  culture: "Culture",
  red_flags: "Red flags",
};

function tierChip(tier: string) {
  if (tier.startsWith("High")) return "chip chip-tier-high";
  if (tier.startsWith("Suspicious")) return "chip chip-tier-sus";
  return "chip chip-tier-caution";
}

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [result, setResult] = useState<Evaluation | null>(null);
  const [error, setError] = useState("");
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
    api.getReport(Number(id))
      .then((r) => setResult(r as unknown as Evaluation))
      .catch(() => setError("Report not found."));
  }, [id]);

  return (
    <div className="container" style={{ maxWidth: "var(--maxw)", paddingBottom: "4rem" }}>
      <div className="page-head">
        <Link href="/dashboard" style={{ color: "var(--ink-55)", fontSize: "0.875rem", textDecoration: "none", display: "inline-block", marginBottom: "1rem" }}>
          ← Back to pipeline
        </Link>
        {result && (
          <div style={{ marginTop: "0.5rem" }}>
            <h1 style={{ margin: 0 }}>{result.company} — {result.role}</h1>
            <p style={{ color: "var(--ink-55)", marginTop: "0.25rem", marginBottom: 0 }}>{result.archetype}</p>
          </div>
        )}
      </div>
      
      {error && <div className="notice notice-error">{error}</div>}
      
      {result && (
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

          </div>

          {/* Right Column: Detailed Markdown Report */}
          <div className="panel" style={{ minWidth: 0, maxHeight: isDesktop ? "calc(100vh - 12rem)" : "none", overflowY: isDesktop ? "auto" : "visible" }}>
            <ReportView markdown={result.report_markdown} />
          </div>
        </div>
      )}
      
      {!result && !error && (
        <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--ink-55)" }}>Loading report…</p>
        </div>
      )}
    </div>
  );
}
