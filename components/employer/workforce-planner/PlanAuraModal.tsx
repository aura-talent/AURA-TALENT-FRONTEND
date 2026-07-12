import { useState } from "react";
import type { JobPlanPayload } from "@/lib/employerApi";
import styles from "./WorkforcePlanner.module.css";

/** Local drafting helper — fills the plan form from the prompt text. No
 * backend/agent call in this pass. */
export default function PlanAuraModal({
  jobTitle,
  onGenerate,
  onClose,
}: {
  jobTitle: string;
  onGenerate: (patch: Partial<JobPlanPayload>) => void;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [includePrediction, setIncludePrediction] = useState(true);
  const [generating, setGenerating] = useState(false);

  function generate() {
    setGenerating(true);
    window.setTimeout(() => {
      onGenerate({
        justification:
          prompt.trim() ||
          `Aura recommends growing this role based on current pipeline velocity and team capacity for ${jobTitle}.`,
        ...(includePrediction
          ? {
              demand_signal_reason: `Aura detected rising demand pressure on ${jobTitle} from recent hiring velocity and open pipeline volume.`,
              demand_signal_risk: "High",
            }
          : {}),
      });
      onClose();
    }, 700);
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
