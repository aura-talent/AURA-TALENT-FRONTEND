"use client";
import { useEffect, useState } from "react";
import { ReportSchema, type Report } from "@/lib/schemas";
import type { Answer } from "@/hooks/use-session";

const VERDICT_CONFIG: Record<Report["verdict"], { label: string; color: string; bg: string; border: string }> = {
  strong: {
    label: "Strong candidate",
    color: "var(--score-strong)",
    bg: "rgba(23, 133, 92, 0.06)",
    border: "rgba(23, 133, 92, 0.2)",
  },
  promising: {
    label: "Promising — keep practicing",
    color: "var(--score-good)",
    bg: "var(--iris-08)",
    border: "var(--iris-12)",
  },
  "needs practice": {
    label: "Needs more practice",
    color: "var(--score-fair)",
    bg: "rgba(185, 125, 20, 0.06)",
    border: "rgba(185, 125, 20, 0.2)",
  },
};

function scoreColor(s: number): string {
  if (s >= 80) return "var(--score-strong)";
  if (s >= 60) return "var(--score-good)";
  if (s >= 40) return "var(--score-fair)";
  return "var(--score-weak)";
}

interface Props {
  role: string;
  answers: Answer[];
  onRestart: () => void;
}

export default function FinalReport({ role, answers, onRestart }: Props) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetch("/api/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role,
        answers: answers.map((a) => ({ question: a.question, evaluation: a.evaluation })),
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Report failed (${res.status})`);
        const data = ReportSchema.parse(await res.json());
        if (!cancelled) setReport(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to generate report");
      });
    return () => { cancelled = true; };
  }, [role, answers]);

  if (error) {
    return (
      <div style={{ minHeight: "calc(100svh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <p style={{ color: "var(--score-weak)", fontSize: "0.9375rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>{error}</p>
          <button onClick={onRestart} style={{ padding: "0.75rem 1.75rem", background: "var(--iris)", color: "#fff", border: "none", borderRadius: "var(--r-pill)", fontWeight: 600, cursor: "pointer" }}>
            Start over
          </button>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div style={{ minHeight: "calc(100svh - 64px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "3rem 1.5rem" }}>
        <div style={{ textAlign: "center" }}>
          <GeneratingSpinner />
          <p style={{ marginTop: "1.25rem", color: "var(--ink-55)", fontSize: "0.9rem", fontFamily: "var(--font-mono), monospace", letterSpacing: "0.06em" }}>
            Generating your report…
          </p>
        </div>
      </div>
    );
  }

  const vc = VERDICT_CONFIG[report.verdict];
  const avgScore = Math.round(
    (report.averagedScores.contentRelevance +
      report.averagedScores.clarityStructure +
      report.averagedScores.confidenceDelivery +
      report.averagedScores.bodyLanguage) / 4
  );
  const maxTrend = Math.max(...report.trend, 1);

  return (
    <div style={{ minHeight: "calc(100svh - 64px)", background: "var(--porcelain)" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 1.5rem 6rem", animation: "report-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}>

        {/* Page header */}
        <div style={{ marginBottom: "2.5rem" }}>
          <span style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.68rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
          }}>
            Interview complete
          </span>
          <h1 style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(1.8rem, 5vw, 2.5rem)",
            fontWeight: 800, letterSpacing: "-0.03em",
            color: "var(--ink)", marginTop: "0.3rem", lineHeight: 1.1,
          }}>
            {role} Mock Interview
          </h1>
        </div>

        {/* Verdict banner */}
        <div style={{
          padding: "1.5rem",
          border: `1.5px solid ${vc.border}`,
          borderRadius: "var(--r-l)",
          background: vc.bg,
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "1.5rem",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            <CircleGauge score={avgScore} size={80} />
            <div>
              <div style={{
                fontFamily: "var(--font-mono), monospace",
                fontSize: "0.65rem", letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
                marginBottom: "0.2rem",
              }}>
                Overall result
              </div>
              <div style={{
                fontFamily: "var(--font-display), sans-serif",
                fontSize: "1.4rem", fontWeight: 800,
                letterSpacing: "-0.025em", color: vc.color,
              }}>
                {vc.label}
              </div>
            </div>
          </div>
          {report.mocked && (
            <span style={{
              padding: "0.2rem 0.6rem",
              borderRadius: "var(--r-pill)", background: "var(--ink-06)",
              color: "var(--ink-55)", fontSize: "0.7rem",
              fontFamily: "var(--font-mono), monospace",
              letterSpacing: "0.06em", fontWeight: 600,
            }}>MOCK</span>
          )}
        </div>

        {/* Score breakdown */}
        <div style={{
          border: "1.5px solid var(--ink-06)",
          borderRadius: "var(--r-l)",
          background: "var(--surface)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
          marginBottom: "1.5rem",
        }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--ink-06)" }}>
            <h3 style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.68rem", letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
            }}>
              Dimension breakdown
            </h3>
          </div>
          <div style={{ padding: "1.25rem 1.5rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            {([
              ["Content relevance", report.averagedScores.contentRelevance],
              ["Clarity & structure", report.averagedScores.clarityStructure],
              ["Confidence & delivery", report.averagedScores.confidenceDelivery],
              ["Body language", report.averagedScores.bodyLanguage],
            ] as [string, number][]).map(([label, value]) => {
              const v = Math.round(value);
              const c = scoreColor(v);
              return (
                <div key={label}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
                    <span style={{ fontSize: "0.8125rem", color: "var(--ink-72)", fontWeight: 500 }}>{label}</span>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.78rem", fontWeight: 700, color: c }}>{v}</span>
                  </div>
                  <div style={{ height: 5, borderRadius: "var(--r-pill)", background: "var(--ink-06)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${v}%`, background: c,
                      borderRadius: "var(--r-pill)",
                      transition: "width 1s cubic-bezier(0.4, 0, 0.2, 1) 0.3s",
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Trend chart */}
        <div style={{
          border: "1.5px solid var(--ink-06)",
          borderRadius: "var(--r-l)",
          background: "var(--surface)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
          marginBottom: "1.5rem",
        }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--ink-06)" }}>
            <h3 style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: "0.68rem", letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
            }}>
              Score per question
            </h3>
          </div>
          <div style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 80 }}>
              {report.trend.map((v, i) => {
                const h = Math.max(6, (v / maxTrend) * 68);
                const c = scoreColor(v);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem" }}>
                    <div style={{
                      width: "100%", borderRadius: "4px 4px 2px 2px",
                      background: c, height: h,
                      minHeight: 6,
                      opacity: 0.85,
                      transition: `height 0.8s cubic-bezier(0.4, 0, 0.2, 1) ${i * 0.08}s`,
                      position: "relative",
                    }}>
                      <span style={{
                        position: "absolute", top: -18, left: "50%",
                        transform: "translateX(-50%)",
                        fontFamily: "var(--font-mono), monospace",
                        fontSize: "0.65rem", color: c, fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}>{v}</span>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "0.62rem", color: "var(--ink-55)" }}>
                      Q{i + 1}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Strengths + Focus areas */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem",
          marginBottom: "1.5rem",
        }}>
          {[
            { title: "Top strengths", items: report.topStrengths, color: "var(--score-strong)", icon: "✦" },
            { title: "Focus areas", items: report.topImprovements, color: "var(--score-fair)", icon: "▲" },
          ].map(({ title, items, color, icon }) => (
            <div key={title} style={{
              border: "1.5px solid var(--ink-06)",
              borderRadius: "var(--r-l)",
              background: "var(--surface)",
              boxShadow: "var(--shadow-card)",
              overflow: "hidden",
            }}>
              <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--ink-06)" }}>
                <h3 style={{
                  fontFamily: "var(--font-mono), monospace",
                  fontSize: "0.65rem", letterSpacing: "0.1em",
                  textTransform: "uppercase", color, fontWeight: 700,
                }}>
                  {title}
                </h3>
              </div>
              <div style={{ padding: "1rem 1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {items.map((s) => (
                  <div key={s} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                    <span style={{ color, fontSize: "0.65rem", marginTop: "0.2em", flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: "0.8125rem", color: "var(--ink-72)", lineHeight: 1.55 }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Closing note */}
        {report.closing && (
          <div style={{
            padding: "1.25rem 1.5rem",
            border: "1.5px solid var(--ink-06)",
            borderRadius: "var(--r-l)",
            background: "var(--surface)",
            boxShadow: "var(--shadow-card)",
            marginBottom: "1.5rem",
          }}>
            <p style={{
              fontSize: "0.9rem", color: "var(--ink-72)", lineHeight: 1.7,
              // borderLeft: "3px solid var(--iris)",
              paddingLeft: "0.85rem",
            }}>
              {report.closing}
            </p>
          </div>
        )}

        {/* CTA */}
        <button
          onClick={onRestart}
          style={{
            width: "100%",
            padding: "1rem 2rem",
            background: "var(--ink)",
            color: "var(--porcelain)",
            border: "none",
            borderRadius: "var(--r-pill)",
            fontSize: "0.9375rem", fontWeight: 600,
            cursor: "pointer",
            display: "flex", alignItems: "center",
            justifyContent: "center", gap: "0.5rem",
            transition: "opacity 0.15s ease",
          }}
        >
          Practice again →
        </button>
      </div>

      <style>{`
        @keyframes report-in {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinner-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function CircleGauge({ score, size }: { score: number; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - 8;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-06)" strokeWidth="5.5" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "var(--font-display), sans-serif",
          fontSize: size * 0.24, fontWeight: 800,
          color, lineHeight: 1, letterSpacing: "-0.02em",
        }}>
          {score}
        </span>
        <span style={{ fontSize: size * 0.115, color: "var(--ink-30)", fontFamily: "var(--font-mono), monospace" }}>
          avg
        </span>
      </div>
    </div>
  );
}

function GeneratingSpinner() {
  return (
    <div style={{ position: "relative", width: 52, height: 52, margin: "0 auto" }}>
      <div style={{
        position: "absolute", inset: 0,
        border: "2.5px solid var(--ink-06)",
        borderTopColor: "var(--iris)",
        borderRightColor: "var(--aura-a)",
        borderRadius: "50%",
        animation: "spinner-spin 1.2s linear infinite",
      }} />
      <div style={{
        position: "absolute", inset: 9,
        border: "2px solid transparent",
        borderTopColor: "var(--aura-b)",
        borderRadius: "50%",
        animation: "spinner-spin 0.8s linear infinite reverse",
      }} />
    </div>
  );
}
