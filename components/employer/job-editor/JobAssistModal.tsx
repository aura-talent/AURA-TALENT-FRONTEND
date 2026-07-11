import type { CreationAssist } from "./types";
import styles from "./JobEditor.module.css";

export default function JobAssistModal({
  assist,
  autoSetupInterview,
  onAutoSetupInterviewChange,
  onClose,
}: {
  assist: CreationAssist;
  autoSetupInterview: boolean;
  onAutoSetupInterviewChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
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
                placeholder="https://linkedin.com/jobs/view/..."
              />
              <small>
                Aura will place extracted details into the manual builder for
                review before creation.
              </small>
            </div>
          </div>
        )}

        <footer>
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onClose} title="AI assist is not wired up yet — fill the form manually for now">
            {assist === "aura" ? "Generate job setup" : "Import listing"}
          </button>
        </footer>
      </section>
    </div>
  );
}
