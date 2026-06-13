"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, type Evaluation, getUserId } from "@/lib/api";
import { useStream } from "@/lib/useStream";
import ScoreDial, { scoreColor } from "@/components/ScoreDial";
import StreamProgress from "@/components/StreamProgress";
import ReportView from "@/components/ReportView";
import Thinking from "@/components/Thinking";
import { useAuth } from "@/components/AuthProvider";


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
  const { user, loading: authLoading } = useAuth();
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

  // States for Tailoring Resume
  const [modalOpen, setModalOpen] = useState(false);
  const [streamProgress, setStreamProgress] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [tailoredMarkdown, setTailoredMarkdown] = useState("");
  const [changeSummary, setChangeSummary] = useState("");
  const [keywordsCovered, setKeywordsCovered] = useState<string[]>([]);
  const [pdfDownloading, setPdfDownloading] = useState(false);

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
    if (!authLoading) {
      if (!user) {
        setHasResume(false);
      } else {
        api.getResume().then(() => setHasResume(true)).catch(() => setHasResume(false));
      }
    }
  }, [user, authLoading]);

  function run() {
    const input = mode === "url" ? { jd_url: url.trim() } : { jd_text: text };
    void streamEvaluate(input);
  }

  async function generateResumeFlow(instructions = "") {
    if (!result) return;
    setIsGenerating(true);
    setStreamError("");
    setStreamProgress("Starting generation...");
    setModalOpen(true);
    try {
      const userId = getUserId();
      const res = await fetch(`/api/backend/resume/generate/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          user_id: userId,
          evaluation_id: result.evaluation_id,
          extra_instructions: instructions,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to start generation";
        try {
          const errData = await res.json();
          if (errData.detail) msg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(msg);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop()!; // keep incomplete frame in buffer

        for (const frame of frames) {
          const trimmed = frame.trim();
          if (!trimmed) continue;
          
          const lines = trimmed.split("\n");
          let eventType = "";
          let dataStr = "";
          for (const line of lines) {
            const l = line.trim();
            if (l.startsWith("event:")) {
              eventType = l.slice(6).trim();
            } else if (l.startsWith("data:")) {
              dataStr = l.slice(5).trim();
            }
          }

          if (!dataStr) continue;
          const data = JSON.parse(dataStr);

          if (eventType === "progress") {
            setStreamProgress(data.message || "Generating...");
          } else if (eventType === "result") {
            setTailoredMarkdown(data.tailored_markdown || "");
            setChangeSummary(data.change_summary || "");
            setKeywordsCovered(data.keywords_covered || []);
            setIsGenerating(false);
            return;
          } else if (eventType === "error") {
            throw new Error(data.detail || "Error during generation stream");
          }
        }
      }
      throw new Error("Stream closed unexpectedly before completion");
    } catch (err: any) {
      console.error(err);
      setStreamError(err.message || "Something went wrong.");
      setIsGenerating(false);
    }
  }

  async function downloadPdf() {
    if (!tailoredMarkdown || !result) return;
    setPdfDownloading(true);
    try {
      const filename = `${result.company}-${result.role}-tailored-resume`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const res = await fetch(`/api/backend/resume/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          markdown: tailoredMarkdown,
          filename: filename,
        }),
      });
      if (!res.ok) {
        let msg = "Failed to render PDF";
        try {
          const errData = await res.json();
          if (errData.detail) msg = typeof errData.detail === "string" ? errData.detail : JSON.stringify(errData.detail);
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `${filename}.pdf`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setPdfDownloading(false);
    }
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
              <div style={{ position: "relative", marginTop: "1.25rem", borderTop: "1px solid var(--ink-06)", paddingTop: "1.25rem" }}>
                {result.score >= 4.0 ? (
                  <button
                    className="btn btn-primary"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={() => generateResumeFlow(extraInstructions)}
                  >
                    Generate Tailored Resume
                  </button>
                ) : (
                  <div>
                    <button
                      className="btn btn-primary"
                      style={{ width: "100%", justifyContent: "center", opacity: 0.5, cursor: "not-allowed" }}
                      disabled
                      title="Only available for roles with score >= 4.0"
                    >
                      Generate Tailored Resume
                    </button>
                    <p style={{ fontSize: "0.75rem", color: "var(--ink-55)", marginTop: "0.5rem", textAlign: "center" }}>
                      ⚠️ Resume tailoring is disabled. Aura discourages tailoring applications for low-fit roles (score &lt; 4.0).
                    </p>
                  </div>
                )}
              </div>
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
        {modalOpen && (
          <div className="modal-backdrop" onClick={() => !isGenerating && setModalOpen(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                  Tailoring Resume for {result.company} — {result.role}
                </h2>
                {!isGenerating && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                    onClick={() => setModalOpen(false)}
                  >
                    Close
                  </button>
                )}
              </div>

              {isGenerating ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "1.5rem" }}>
                  <Thinking lines={[
                    streamProgress,
                    "Still writing your resume...",
                    "Polishing your experience alignment...",
                    "Finalizing changes...",
                  ]} />
                  <div style={{ fontSize: "0.85rem", color: "var(--ink-55)", marginTop: "-0.5rem" }}>
                    This process usually takes between 20 to 60 seconds.
                  </div>
                </div>
              ) : streamError ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "3rem", gap: "1rem" }}>
                  <div className="notice notice-error" style={{ maxWidth: "500px" }}>
                    <strong>Generation failed:</strong>
                    <p style={{ marginTop: "0.5rem" }}>{streamError}</p>
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => generateResumeFlow(extraInstructions)}
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <>
                  <div className="modal-body">
                    {/* Left Column: Editable markdown */}
                    <div className="modal-split-left">
                      <div style={{ padding: "0.75rem 1.5rem 0 1.5rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-55)", display: "flex", justifyContent: "space-between" }}>
                        <span>EDIT RESUME (MARKDOWN)</span>
                        <span>{tailoredMarkdown.length} chars</span>
                      </div>
                      <textarea
                        className="resume-editor"
                        value={tailoredMarkdown}
                        onChange={(e) => setTailoredMarkdown(e.target.value)}
                      />
                    </div>

                    {/* Right Column: Changes and details */}
                    <div className="modal-split-right">
                      <div>
                        <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.6rem" }}>What changed and why</h3>
                        {changeSummary ? (
                          <ReportView markdown={changeSummary} />
                        ) : (
                          <p style={{ fontSize: "0.875rem", color: "var(--ink-55)" }}>No summary of changes provided.</p>
                        )}
                      </div>

                      {keywordsCovered && keywordsCovered.length > 0 && (
                        <div>
                          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.6rem" }}>Keywords Covered</h3>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                            {keywordsCovered.map((kw, idx) => (
                              <span key={idx} className="keyword-badge">
                                {kw}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ borderTop: "1px solid var(--ink-06)", paddingTop: "1.25rem", marginTop: "auto" }}>
                        <div className="field">
                          <label htmlFor="extra-instr" style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.4rem" }}>
                            Custom focus instructions (optional)
                          </label>
                          <textarea
                            id="extra-instr"
                            className="input"
                            style={{ height: "70px", resize: "none", fontSize: "0.85rem", padding: "0.5rem" }}
                            placeholder="e.g. emphasize my Golang experience, make it sound more leadership-oriented..."
                            value={extraInstructions}
                            onChange={(e) => setExtraInstructions(e.target.value)}
                          />
                        </div>
                        <button
                          className="btn btn-ghost"
                          style={{ width: "100%", justifyContent: "center", marginTop: "0.5rem" }}
                          onClick={() => generateResumeFlow(extraInstructions)}
                        >
                          Regenerate with instructions
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button
                      className="btn btn-ghost"
                      onClick={() => setModalOpen(false)}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn btn-primary text-white"
                      disabled={pdfDownloading || tailoredMarkdown.length < 100}
                      onClick={downloadPdf}
                    >
                      {pdfDownloading ? "Generating PDF..." : "Download PDF"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
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
