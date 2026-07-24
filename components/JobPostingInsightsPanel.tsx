"use client";

import { useState } from "react";
import type { JobInsights } from "@/lib/api";

interface Props {
  insights: JobInsights;
  company?: string;
  role?: string;
}

type PlatformTab = "glassdoor" | "reddit" | "jobstreet";

function verdictBadgeStyle(verdict: string) {
  const v = verdict.toLowerCase();
  if (v.includes("above")) {
    return { background: "rgba(23, 133, 92, 0.12)", color: "var(--score-strong)", border: "1px solid rgba(23, 133, 92, 0.3)" };
  }
  if (v.includes("at market") || v.includes("fair")) {
    return { background: "var(--iris-08)", color: "var(--iris)", border: "1px solid var(--iris-20)" };
  }
  if (v.includes("below")) {
    return { background: "rgba(217, 83, 79, 0.12)", color: "var(--score-weak)", border: "1px solid rgba(217, 83, 79, 0.3)" };
  }
  return { background: "var(--ink-05)", color: "var(--ink-70)", border: "1px solid var(--ink-15)" };
}

function sentimentBadgeStyle(label: string) {
  const l = label.toLowerCase();
  if (l.includes("favorable") || l.includes("positive")) {
    return { background: "rgba(23, 133, 92, 0.12)", color: "var(--score-strong)" };
  }
  if (l.includes("mixed") || l.includes("fair")) {
    return { background: "rgba(185, 125, 20, 0.12)", color: "var(--score-fair)" };
  }
  return { background: "rgba(217, 83, 79, 0.12)", color: "var(--score-weak)" };
}

export default function JobPostingInsightsPanel({ insights, company, role }: Props) {
  const [activeTab, setActiveTab] = useState<PlatformTab>("glassdoor");
  const { salary_comparison: sc, sentiment: st } = insights;

  return (
    <div className="panel sal-panel" style={{ marginTop: "1.5rem", position: "relative" }}>
      <span className="eval-tick eval-tick-tl" />
      <span className="eval-tick eval-tick-tr" />
      <span className="eval-tick eval-tick-bl" />
      <span className="eval-tick eval-tick-br" />

      {/* Blueprint kicker header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.25rem" }}>
        <div>
          <div className="page-kicker" style={{ marginBottom: "0.25rem" }}>
            JOB_POSTING_INSIGHTS // MARKET_RATE & PLATFORM_SENTIMENT
          </div>
          <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, fontFamily: "var(--font-space), monospace", color: "var(--ink)" }}>
            {company ? `${company} Market Intelligence` : "Market & Sentiment Insights"}
          </h3>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "4px",
              fontSize: "0.75rem",
              fontWeight: 700,
              fontFamily: "var(--font-space), monospace",
              ...sentimentBadgeStyle(st.overall_label),
            }}
          >
            {st.overall_score.toFixed(1)} / 5.0 • {st.overall_label.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Top 2 Metric Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(290px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        
        {/* Card 1: Salary Market Rate Comparison */}
        <div style={{ background: "rgba(255, 255, 255, 0.6)", border: "1px solid var(--ink-10)", borderRadius: "6px", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-space), monospace", textTransform: "uppercase", color: "var(--ink-55)", letterSpacing: "0.05em" }}>
              💵 Salary vs Market Benchmark
            </span>
            <span style={{ padding: "0.15rem 0.5rem", borderRadius: "3px", fontSize: "0.7rem", fontWeight: 700, fontFamily: "var(--font-space), monospace", ...verdictBadgeStyle(sc.comparison_verdict) }}>
              {sc.comparison_verdict}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 800, fontFamily: "var(--font-space), monospace", color: "var(--ink)" }}>
              {sc.market_median}
            </span>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-55)" }}>market median</span>
          </div>

          {/* Delta & Percentile visual */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.8rem", marginBottom: "0.75rem" }}>
            <span style={{ color: sc.delta_pct >= 0 ? "var(--score-strong)" : "var(--score-weak)", fontWeight: 700, fontFamily: "var(--font-space), monospace" }}>
              {sc.delta_pct > 0 ? `+${sc.delta_pct}%` : `${sc.delta_pct}%`} vs median
            </span>
            <span style={{ color: "var(--ink-40)" }}>•</span>
            <span style={{ color: "var(--ink-70)", fontWeight: 600 }}>{sc.percentile_estimate}th percentile</span>
          </div>

          {/* Market Band Bar */}
          <div style={{ marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "var(--ink-55)", marginBottom: "0.25rem", fontFamily: "var(--font-space), monospace" }}>
              <span>P25-P75 Band: {sc.market_band}</span>
            </div>
            <div style={{ height: "6px", width: "100%", background: "var(--ink-10)", borderRadius: "3px", overflow: "hidden", position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: "20%",
                  right: "20%",
                  height: "100%",
                  background: "var(--iris-20)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${Math.min(95, Math.max(5, sc.percentile_estimate))}%`,
                  top: 0,
                  bottom: 0,
                  width: "4px",
                  background: "var(--iris)",
                  transform: "translateX(-50%)",
                  boxShadow: "0 0 4px var(--iris)",
                }}
              />
            </div>
          </div>

          <p style={{ margin: 0, fontSize: "0.825rem", color: "var(--ink-70)", lineHeight: 1.45 }}>
            {sc.summary}
          </p>

          {sc.negotiation_anchor && (
            <div style={{ marginTop: "0.65rem", paddingTop: "0.5rem", borderTop: "1px stroke var(--ink-08)", fontSize: "0.75rem", color: "var(--iris)", fontWeight: 600, fontFamily: "var(--font-space), monospace" }}>
              💡 Negotiation Anchor: {sc.negotiation_anchor}
            </div>
          )}
        </div>

        {/* Card 2: Sentiment Overview & Key Takeaways */}
        <div style={{ background: "rgba(255, 255, 255, 0.6)", border: "1px solid var(--ink-10)", borderRadius: "6px", padding: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-space), monospace", textTransform: "uppercase", color: "var(--ink-55)", letterSpacing: "0.05em" }}>
              🗣️ Multi-Platform Sentiment Synthesis
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem", marginBottom: "0.75rem", textAlign: "center" }}>
            <div style={{ background: "var(--porcelain)", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--ink-08)" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-55)", fontWeight: 700 }}>GLASSDOOR</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--score-strong)", fontFamily: "var(--font-space), monospace" }}>
                {st.glassdoor.rating.toFixed(1)}★
              </div>
            </div>
            <div style={{ background: "var(--porcelain)", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--ink-08)" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-55)", fontWeight: 700 }}>REDDIT</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--iris)", fontFamily: "var(--font-space), monospace", marginTop: "0.15rem" }}>
                {st.reddit.sentiment_label}
              </div>
            </div>
            <div style={{ background: "var(--porcelain)", padding: "0.5rem", borderRadius: "4px", border: "1px solid var(--ink-08)" }}>
              <div style={{ fontSize: "0.65rem", color: "var(--ink-55)", fontWeight: 700 }}>JOBSTREET</div>
              <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--score-good)", fontFamily: "var(--font-space), monospace" }}>
                {st.jobstreet.rating.toFixed(1)}★
              </div>
            </div>
          </div>

          <div style={{ fontSize: "0.825rem", color: "var(--ink-80)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "var(--ink-55)", marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Key Community Takeaways:
            </div>
            <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.5 }}>
              {st.key_takeaways.map((point, idx) => (
                <li key={idx} style={{ marginBottom: "0.25rem" }}>{point}</li>
              ))}
            </ul>
          </div>
        </div>

      </div>

      {/* Platform Deep-Dive Tabs */}
      <div style={{ background: "rgba(255, 255, 255, 0.4)", border: "1px solid var(--ink-10)", borderRadius: "6px", padding: "1.25rem" }}>
        
        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--ink-10)", paddingBottom: "0.75rem", marginBottom: "1rem" }}>
          <button
            type="button"
            onClick={() => setActiveTab("glassdoor")}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "4px",
              border: "none",
              background: activeTab === "glassdoor" ? "var(--iris)" : "transparent",
              color: activeTab === "glassdoor" ? "#fff" : "var(--ink-70)",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "var(--font-space), monospace",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            🟩 Glassdoor ({st.glassdoor.rating.toFixed(1)}★)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("reddit")}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "4px",
              border: "none",
              background: activeTab === "reddit" ? "var(--iris)" : "transparent",
              color: activeTab === "reddit" ? "#fff" : "var(--ink-70)",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "var(--font-space), monospace",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            🟧 Reddit Community ({st.reddit.sentiment_label})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("jobstreet")}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "4px",
              border: "none",
              background: activeTab === "jobstreet" ? "var(--iris)" : "transparent",
              color: activeTab === "jobstreet" ? "#fff" : "var(--ink-70)",
              fontSize: "0.8rem",
              fontWeight: 700,
              fontFamily: "var(--font-space), monospace",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
          >
            🟦 JobStreet SEA ({st.jobstreet.rating.toFixed(1)}★)
          </button>
        </div>

        {/* Tab Content 1: Glassdoor */}
        {activeTab === "glassdoor" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ background: "#fff", padding: "0.6rem", borderRadius: "4px", border: "1px solid var(--ink-08)", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>Culture & Values</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--score-strong)" }}>{st.glassdoor.culture_score.toFixed(1)} / 5.0</div>
              </div>
              <div style={{ background: "#fff", padding: "0.6rem", borderRadius: "4px", border: "1px solid var(--ink-08)", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>Work-Life Balance</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--score-good)" }}>{st.glassdoor.work_life_balance_score.toFixed(1)} / 5.0</div>
              </div>
              <div style={{ background: "#fff", padding: "0.6rem", borderRadius: "4px", border: "1px solid var(--ink-08)", textAlign: "center" }}>
                <div style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>Recommend to Friend</div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "var(--iris)" }}>{st.glassdoor.recommend_to_friend_pct}%</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
              <div style={{ background: "rgba(23, 133, 92, 0.04)", border: "1px solid rgba(23, 133, 92, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-strong)", marginBottom: "0.4rem" }}>
                  ✅ Employee Pros
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.glassdoor.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: "rgba(217, 83, 79, 0.04)", border: "1px solid rgba(217, 83, 79, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-weak)", marginBottom: "0.4rem" }}>
                  ⚠️ Employee Cons
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.glassdoor.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 2: Reddit */}
        {activeTab === "reddit" && (
          <div>
            <div style={{ background: "#fff", border: "1px solid var(--ink-10)", borderRadius: "4px", padding: "0.75rem", marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>
                Community Consensus (r/cscareerquestions & Regional Tech Subs)
              </div>
              <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--ink)" }}>
                &ldquo;{st.reddit.community_consensus}&rdquo;
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
              <div style={{ background: "rgba(79, 70, 229, 0.04)", border: "1px solid rgba(79, 70, 229, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--iris)", marginBottom: "0.4rem" }}>
                  💬 Key Discussion Themes
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.reddit.key_discussions.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: "rgba(217, 83, 79, 0.04)", border: "1px solid rgba(217, 83, 79, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-weak)", marginBottom: "0.4rem" }}>
                  🚨 Redditor Flags & Tea
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.reddit.red_flags.map((rf, i) => (
                    <li key={i}>{rf}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content 3: JobStreet */}
        {activeTab === "jobstreet" && (
          <div>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div style={{ background: "#fff", padding: "0.6rem 1rem", borderRadius: "4px", border: "1px solid var(--ink-08)" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>Portal Rating: </span>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--score-good)" }}>{st.jobstreet.rating.toFixed(1)} / 5.0</span>
              </div>
              <div style={{ background: "#fff", padding: "0.6rem 1rem", borderRadius: "4px", border: "1px solid var(--ink-08)" }}>
                <span style={{ fontSize: "0.7rem", color: "var(--ink-55)" }}>Employment Stability: </span>
                <span style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--iris)" }}>{st.jobstreet.stability_rating}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
              <div style={{ background: "rgba(23, 133, 92, 0.04)", border: "1px solid rgba(23, 133, 92, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-strong)", marginBottom: "0.4rem" }}>
                  👍 Regional Employer Highlights
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.jobstreet.pros.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>

              <div style={{ background: "rgba(185, 125, 20, 0.04)", border: "1px solid rgba(185, 125, 20, 0.15)", borderRadius: "4px", padding: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-fair)", marginBottom: "0.4rem" }}>
                  👎 Regional Considerations
                </div>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--ink-80)", lineHeight: 1.4 }}>
                  {st.jobstreet.cons.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Probing Questions for Interviews */}
      {st.interview_questions && st.interview_questions.length > 0 && (
        <div style={{ marginTop: "1.25rem", background: "var(--iris-08)", border: "1px solid var(--iris-20)", borderRadius: "6px", padding: "1rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "var(--font-space), monospace", color: "var(--iris)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
            🎯 Suggested Questions to Ask in Interviews (Based on Sentiment Feedback):
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", fontSize: "0.825rem", color: "var(--ink-90)", lineHeight: 1.5 }}>
            {st.interview_questions.map((q, idx) => (
              <li key={idx} style={{ marginBottom: "0.3rem" }}>
                <strong>&ldquo;{q}&rdquo;</strong>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
