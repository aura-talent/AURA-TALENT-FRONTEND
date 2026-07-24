"use client";
import { useState, useEffect } from "react";
import { QuestionsResponseSchema } from "@/lib/schemas";

const SUGGESTIONS = [
  "Software Engineer", "Product Manager", "Data Scientist",
  "UX Designer", "Marketing Manager", "DevOps Engineer",
];

interface Props {
  onStart: (role: string, questions: string[], mocked: boolean) => void;
}

export default function SetupScreen({ onStart }: Props) {
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const roleParam = params.get("role");
      if (roleParam) {
        setRole(roleParam);
      }
    }
  }, []);

  async function begin() {
    if (!role.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/questions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = QuestionsResponseSchema.parse(await res.json());
      onStart(role, data.questions, data.mocked);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "calc(100svh - 64px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1.5rem",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Drafting-grid background, continuing the blueprint sheet */}
      <div aria-hidden style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(26, 29, 41, 0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(26, 29, 41, 0.035) 1px, transparent 1px)
        `,
        backgroundSize: "44px 44px",
        pointerEvents: "none",
      }} />
      <span aria-hidden style={{
        position: "absolute", top: "1.75rem", left: "clamp(1.5rem, 4vw, 3rem)",
        fontFamily: "var(--font-space), monospace", fontSize: "0.6875rem",
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--ink-55)", lineHeight: 1.7,
      }}>
        MOCK_INTERVIEW<br />SIMULATOR_V1
      </span>
      <span aria-hidden style={{
        position: "absolute", bottom: "1.75rem", right: "clamp(1.5rem, 4vw, 3rem)",
        fontFamily: "var(--font-space), monospace", fontSize: "0.6875rem",
        letterSpacing: "0.08em", textTransform: "uppercase",
        color: "var(--ink-55)", lineHeight: 1.7, textAlign: "right",
      }}>
        (DIAGRAM 03)<br />AWAITING_ROLE
      </span>

      <div style={{ width: "100%", maxWidth: 520, position: "relative", animation: "setup-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
        {/* Logo mark */}
        <div style={{ marginBottom: "3rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "var(--iris)",
              boxShadow: "0 0 0 4px var(--iris-12)",
            }} />
            <span style={{
              fontFamily: "var(--font-space), monospace",
              fontSize: "0.6875rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--iris)",
              fontWeight: 700,
            }}>
              (01) // ROLE_SELECT
            </span>
          </div>
          <h1 style={{
            fontFamily: "var(--font-space), monospace",
            fontSize: "clamp(1.9rem, 5vw, 2.9rem)",
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.12,
            textTransform: "uppercase",
            color: "var(--ink)",
          }}>
            Which role are<br />
            <span style={{ color: "var(--iris)" }}>
              you practicing?
            </span>
          </h1>
          <p style={{ color: "var(--ink-55)", fontSize: "1rem", lineHeight: 1.6, maxWidth: 380 }}>
            AI analysis of what you say, how you say it, and your on-camera presence.
          </p>
        </div>

        {/* Input group */}
        <div style={{ marginBottom: "1.5rem" }} data-tour="mock-interview-input">
          <div style={{
            display: "flex",
            gap: "0",
            border: "1px solid var(--ink-30)",
            borderRadius: 0,
            background: "var(--surface)",
            boxShadow: "var(--shadow-card)",
            overflow: "hidden",
            transition: "border-color 0.2s, box-shadow 0.2s",
            ...(role ? {
              borderColor: "var(--iris-deep)",
              boxShadow: "0 0 0 3px var(--iris-12)",
            } : {}),
          }}>
            <input
              type="text"
              placeholder="e.g. Senior Frontend Engineer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && begin()}
              disabled={loading}
              style={{
                flex: 1,
                padding: "0.9rem 1.25rem",
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "1rem",
                fontFamily: "var(--font-body), system-ui",
                color: "var(--ink)",
                minWidth: 0,
              }}
            />
            <button
              onClick={begin}
              disabled={!role.trim() || loading}
              style={{
                padding: "0.75rem 1.4rem",
                margin: "0.3rem 0.3rem 0.3rem 0",
                background: !role.trim() || loading ? "var(--ink-06)" : "var(--iris)",
                color: !role.trim() || loading ? "var(--ink-30)" : "#fff",
                border: "none",
                borderRadius: 0,
                fontFamily: "var(--font-space), monospace",
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: !role.trim() || loading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              {loading ? (
                <><LoadingDots /> Preparing…</>
              ) : (
                <>Begin <ArrowRight /></>
              )}
            </button>
          </div>
          {error && (
            <p style={{ marginTop: "0.6rem", fontSize: "0.8125rem", color: "var(--score-weak)", paddingLeft: "0.25rem" }}>
              {error}
            </p>
          )}
        </div>

        {/* Suggestions */}
        <div>
          <p style={{
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.68rem",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--ink-30)",
            marginBottom: "0.6rem",
            fontWeight: 600,
          }}>
            Quick start
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setRole(s)}
                disabled={loading}
                style={{
                  padding: "0.35rem 0.85rem",
                  border: "1px solid var(--ink-30)",
                  borderRadius: 0,
                  background: role === s ? "var(--iris-08)" : "var(--surface)",
                  borderColor: role === s ? "var(--iris)" : "var(--ink-12)",
                  color: role === s ? "var(--iris-deep)" : "var(--ink-72)",
                  fontFamily: "var(--font-space), monospace",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          marginTop: "3rem",
          display: "flex",
          gap: "2rem",
          borderTop: "1px dashed var(--ink-30)",
          paddingTop: "1.5rem",
        }}>
          {[
            { num: "5", label: "AI questions" },
            { num: "4", label: "Scored dimensions" },
            { num: "∞", label: "Practice sessions" },
          ].map(({ num, label }) => (
            <div key={label}>
              <div style={{
                fontFamily: "var(--font-space), monospace",
                fontSize: "1.6rem",
                fontWeight: 700,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
                lineHeight: 1,
              }}>{num}</div>
              <div style={{
                fontFamily: "var(--font-space), monospace",
                fontSize: "0.6875rem", letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--ink-55)", marginTop: "0.3rem",
              }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes setup-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          40% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 12 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%",
          background: "currentColor",
          display: "inline-block",
          animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}
