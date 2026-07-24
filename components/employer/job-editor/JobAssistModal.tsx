"use client";

import { useState } from "react";
import { employerApi, type JobDraftResult } from "@/lib/employerApi";
import type { CreationAssist } from "./types";
import styles from "./JobEditor.module.css";

export default function JobAssistModal({
  assist,
  autoSetupInterview,
  onAutoSetupInterviewChange,
  onApplyDraft,
  onClose,
}: {
  assist: CreationAssist;
  autoSetupInterview: boolean;
  onAutoSetupInterviewChange: (enabled: boolean) => void;
  onApplyDraft: (result: JobDraftResult) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const result = await employerApi.draftJob(
        assist === "aura"
          ? { mode: "aura", brief: prompt.trim(), question_count: autoSetupInterview ? 5 : 0 }
          : { mode: "url", jd_url: url.trim(), question_count: autoSetupInterview ? 5 : 0 },
      );
      onApplyDraft(result);
      onClose();
    } catch (err) {
      console.error("Job draft failed:", err);
      setError(err instanceof Error ? err.message : "Draft failed — fill the form manually.");
    } finally {
      setBusy(false);
    }
  }

  const canRun = assist === "aura" ? prompt.trim().length > 0 : url.trim().length > 0;

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <section
        className={styles.assistModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-assist-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">
              {assist === "aura"
                ? "Aura role generator"
                : "Import existing listing"}
            </p>
            <h2 id="job-assist-title">
              {assist === "aura"
                ? "Describe who you need"
                : "Import from a job URL"}
            </h2>
          </div>
          <button
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {assist === "aura" ? (
          <div className={styles.modalBody}>
            <div className="field">
              <label htmlFor="aura-job-prompt">Hiring prompt</label>
              <textarea
                id="aura-job-prompt"
                className={`input ${styles.assistPrompt}`}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Example: We need a senior product designer for our B2B AI platform. They should lead discovery, build our design system, and collaborate closely with a distributed engineering team..."
              />
              <small>
                Include the responsibilities, seniority, skills, team context,
                compensation, or outcomes that matter most.
              </small>
            </div>

            <label className={styles.interviewEnable}>
              <input
                type="checkbox"
                checked={autoSetupInterview}
                onChange={(event) =>
                  onAutoSetupInterviewChange(event.target.checked)
                }
              />
              <span className={styles.check}>✓</span>
              <span>
                <strong>Automatically set up the mock interview</strong>
                <small>
                  Aura will prepare interview questions and evaluation
                  priorities from the same hiring prompt.
                </small>
              </span>
            </label>
          </div>
        ) : (
          <div className={styles.modalBody}>
            <div className="field">
              <label htmlFor="job-import-url">Job listing URL</label>
              <input
                id="job-import-url"
                className="input"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/jobs/..."
              />
              <small>
                Aura will place extracted details into the manual builder for
                review before creation.
              </small>
            </div>
          </div>
        )}

        {error && (
          <p style={{ color: "#dc2626", fontSize: "0.8rem", padding: "0 1.5rem" }}>{error}</p>
        )}

        <footer>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={run} disabled={!canRun || busy}>
            {busy
              ? "Drafting…"
              : assist === "aura"
                ? "Generate job setup"
                : "Import listing"}
          </button>
        </footer>
      </section>
    </div>
  );
}
