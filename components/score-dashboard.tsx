"use client";
import type { Evaluation } from "@/lib/schemas";

const DIMENSIONS: { key: keyof Evaluation["scores"]; label: string; abbr: string }[] = [
  { key: "contentRelevance", label: "Content relevance", abbr: "Content" },
  { key: "clarityStructure", label: "Clarity & structure", abbr: "Clarity" },
  { key: "confidenceDelivery", label: "Confidence & delivery", abbr: "Confidence" },
  { key: "bodyLanguage", label: "Body language", abbr: "Body language" },
];

export function scoreColor(s: number): string {
  if (s >= 80) return "var(--score-strong)";
  if (s >= 60) return "var(--score-good)";
  if (s >= 40) return "var(--score-fair)";
  return "var(--score-weak)";
}

function scoreLabel(s: number): string {
  if (s >= 80) return "Strong";
  if (s >= 60) return "Good";
  if (s >= 40) return "Fair";
  return "Needs work";
}

export default function ScoreDashboard({ evaluation }: { evaluation: Evaluation }) {
  const { overallScore, scores, strengths, improvements, summary, mocked } = evaluation;
  const color = scoreColor(overallScore);

  return (
    <div style={{
      border: "1px solid var(--ink-30)",
      borderRadius: 0,
      background: "var(--surface)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "1.5rem 1.5rem 1rem",
        borderBottom: "1px dashed var(--ink-30)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          <CircleGauge score={overallScore} size={72} />
          <div>
            <div style={{
              fontFamily: "var(--font-space), monospace",
              fontSize: "0.65rem", letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
              marginBottom: "0.2rem",
            }}>
              Overall score
            </div>
            <div style={{
              fontFamily: "var(--font-space), monospace",
              fontSize: "1.05rem", fontWeight: 700, textTransform: "uppercase",
              letterSpacing: "-0.025em", color: "var(--ink)",
            }}>
              {scoreLabel(overallScore)}
            </div>
          </div>
        </div>
        {mocked && (
          <span style={{
            padding: "0.2rem 0.6rem",
            borderRadius: 0,
            background: "var(--ink-06)",
            color: "var(--ink-55)",
            fontSize: "0.7rem",
            fontFamily: "var(--font-space), monospace",
            letterSpacing: "0.06em",
            fontWeight: 600,
          }}>
            MOCK
          </span>
        )}
      </div>

      {/* Score bars */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px dashed var(--ink-30)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
          {DIMENSIONS.map(({ key, abbr }) => {
            const val = scores[key];
            const c = scoreColor(val);
            return (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.3rem" }}>
                  <span style={{ fontSize: "0.8125rem", color: "var(--ink-72)", fontWeight: 500 }}>{abbr}</span>
                  <span style={{
                    fontFamily: "var(--font-space), monospace",
                    fontSize: "0.78rem", fontWeight: 700, color: c,
                  }}>
                    {val}
                  </span>
                </div>
                <div style={{ height: 5, borderRadius: 0, background: "var(--ink-06)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%",
                    width: `${val}%`,
                    background: c,
                    borderRadius: 0,
                    transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths + Improvements */}
      <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px dashed var(--ink-30)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem" }}>
        <div>
          <div style={{
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.65rem", letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--score-strong)",
            fontWeight: 700, marginBottom: "0.6rem",
          }}>
            Strengths
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {strengths.map((s) => (
              <div key={s} style={{
                display: "flex", gap: "0.5rem", alignItems: "flex-start",
              }}>
                <span style={{ color: "var(--score-strong)", fontSize: "0.7rem", marginTop: "0.1em", flexShrink: 0 }}>✦</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--ink-72)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.65rem", letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--score-fair)",
            fontWeight: 700, marginBottom: "0.6rem",
          }}>
            Improve
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            {improvements.map((s) => (
              <div key={s} style={{
                display: "flex", gap: "0.5rem", alignItems: "flex-start",
              }}>
                <span style={{ color: "var(--score-fair)", fontSize: "0.7rem", marginTop: "0.1em", flexShrink: 0 }}>▲</span>
                <span style={{ fontSize: "0.8125rem", color: "var(--ink-72)", lineHeight: 1.5 }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div style={{ padding: "1.25rem 1.5rem" }}>
        <p style={{
          fontFamily: "var(--font-space), monospace",
          fontSize: "0.65rem", letterSpacing: "0.1em",
          textTransform: "uppercase", color: "var(--ink-55)",
          fontWeight: 700, marginBottom: "0.6rem",
        }}>
          Summary
        </p>
        <p style={{
          fontSize: "0.875rem",
          color: "var(--ink-72)",
          lineHeight: 1.65,
        }}>
          {summary}
        </p>
      </div>
    </div>
  );
}

function CircleGauge({ score, size }: { score: number; size: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const r = cx - 7;
  const circumference = 2 * Math.PI * r;
  const filled = (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--ink-06)" strokeWidth="5" />
        <circle
          cx={cx} cy={cy} r={r}
          fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1) 0.2s" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}>
        <span style={{
          fontFamily: "var(--font-space), monospace",
          fontSize: size * 0.26, fontWeight: 700,
          color, lineHeight: 1, letterSpacing: "-0.02em",
        }}>
          {score}
        </span>
      </div>
    </div>
  );
}
