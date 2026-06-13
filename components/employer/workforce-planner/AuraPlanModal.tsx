import styles from "./WorkforcePlanner.module.css";

export default function AuraPlanModal({ onClose }: { onClose: () => void }) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <section
        className={styles.auraModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="aura-plan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow">Aura workforce planner</p>
            <h2 id="aura-plan-title">Describe your hiring outlook</h2>
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
              placeholder="Example: We are launching two products in Q3, expanding the platform team, and need to keep annual hiring spend below RM 2.5m..."
            />
            <small>
              Include business goals, expected growth, team constraints,
              attrition concerns, timing, and budget limits.
            </small>
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" defaultChecked />
            <span>
              <strong>Include Aura demand predictions</strong>
              <small>
                Use workforce signals to recommend priority teams and timing.
              </small>
            </span>
          </label>
        </div>

        <footer>
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="button" onClick={onClose}>
            Generate plan
          </button>
        </footer>
      </section>
    </div>
  );
}
