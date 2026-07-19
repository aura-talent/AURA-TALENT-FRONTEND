"use client";

import { useState } from "react";
import { employerApi, type JobPlanPayload } from "@/lib/employerApi";
import styles from "./WorkforcePlanner.module.css";

/** Drafts a workforce plan via the planning agent (POST /job-plans/draft) and
 * fills the plan form with the result. */
export default function PlanAuraModal({
  jobId,
  jobTitle,
  onGenerate,
  onClose,
}: {
  jobId?: string;
  jobTitle: string;
  onGenerate: (patch: Partial<JobPlanPayload>) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [includePrediction, setIncludePrediction] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const draft = await employerApi.draftPlan({
        job_id: jobId,
        brief: prompt.trim() || undefined,
        title: jobTitle,
      });
      onGenerate({
        priority: draft.priority ?? undefined,
        openings: draft.openings,
        baseline_headcount: draft.baseline_headcount ?? undefined,
        budget: draft.budget ?? undefined,
        target_start_date: draft.target_start_date ?? undefined,
        target_fill_date: draft.target_fill_date ?? undefined,
        justification: draft.justification,
        ...(includePrediction
          ? {
              demand_signal_reason: draft.demand_signal_reason ?? undefined,
              demand_signal_risk: draft.demand_signal_risk ?? undefined,
            }
          : {}),
      });
      onClose();
    } catch (err) {
      console.error("Plan draft failed:", err);
      setError(err instanceof Error ? err.message : "Draft failed — fill the plan manually.");
      setGenerating(false);
    }
  }

  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <section
        className={styles.auraModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-aura-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Aura workforce planner</p>
            <h2 id="plan-aura-title">Draft a plan for {jobTitle}</h2>
          </div>
          <button
            className={styles.modalClose}
            type="button"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className={styles.modalBody}>
          <div className="field">
            <label htmlFor="workforce-prompt">Planning context</label>
            <textarea
              id="workforce-prompt"
              className={`input ${styles.prompt}`}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder={`Example: We are scaling ${jobTitle.toLowerCase()} capacity ahead of a Q3 launch and need to stay under budget...`}
            />
            <small>
              Include business goals, expected growth, team constraints,
              attrition concerns, timing, and budget limits.
            </small>
          </div>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={includePrediction}
              onChange={(event) => setIncludePrediction(event.target.checked)}
            />
            <span>
              <strong>Include Aura demand prediction</strong>
              <small>
                Use workforce signals to recommend priority and timing for
                this role.
              </small>
            </span>
          </label>
        </div>

        {error && (
          <p style={{ color: "#dc2626", fontSize: "0.8rem", padding: "0 1.5rem" }}>{error}</p>
        )}

        <footer>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={generating}
            onClick={generate}
          >
            {generating ? "Generating…" : "Generate plan"}
          </button>
        </footer>
      </section>
    </div>
  );
}
