"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api, type Evaluation, getUserId } from "@/lib/api";
import ReportView from "@/components/ReportView";
import ScoreDial, { scoreColor } from "@/components/ScoreDial";
import SalaryPanel from "@/components/SalaryPanel";
import Thinking from "@/components/Thinking";

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

  async function generateResumeFlow(instructions = "") {
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
          evaluation_id: Number(id),
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
    if (!tailoredMarkdown) return;
    setPdfDownloading(true);
    try {
      const filename = `${result?.company || "company"}-${result?.role || "role"}-tailored-resume`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
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

            {result.salary && <SalaryPanel salary={result.salary} />}

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

      {modalOpen && (
        <div className="modal-backdrop" onClick={() => !isGenerating && setModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: "1.25rem", margin: 0 }}>
                Tailoring Resume for {result?.company} — {result?.role}
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
