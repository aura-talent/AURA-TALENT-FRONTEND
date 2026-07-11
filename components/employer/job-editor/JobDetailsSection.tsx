import SectionHeader from "./SectionHeader";
import type { CreationAssist, JobDetails, JobEditorMode } from "./types";
import styles from "./JobEditor.module.css";

export default function JobDetailsSection({
  mode,
  details,
  onChange,
  onOpenAssist,
}: {
  mode: JobEditorMode;
  details: JobDetails;
  onChange: (patch: Partial<JobDetails>) => void;
  onOpenAssist: (assist: CreationAssist) => void;
}) {
  return (
    <section className={`panel employer-section ${styles.section}`}>
      <SectionHeader
        number="01"
        title="Job details"
        description="Build the role manually, or use a shortcut to prepare the initial details for you."
      />

      {mode === "create" && (
        <div className={styles.creationAssists}>
          <button
            className={`${styles.creationAssist} ${styles.auraAssist}`}
            onClick={() => onOpenAssist("aura")}
          >
            <span>✦</span>
            <div>
              <strong>Generate with Aura</strong>
              <p>
                Describe the hire and let Aura prepare the role, keywords,
                scoring, and optional interview.
              </p>
            </div>
            <b>Open →</b>
          </button>

          <button
            className={styles.creationAssist}
            onClick={() => onOpenAssist("url")}
          >
            <span>↗</span>
            <div>
              <strong>Import from URL</strong>
              <p>
                Bring in an existing listing and review the extracted details in
                this builder.
              </p>
            </div>
            <b>Open →</b>
          </button>
        </div>
      )}

      <div className="form-grid">
        <div className="field">
          <label>Job title</label>
          <input
            className="input"
            value={details.title}
            onChange={(event) => onChange({ title: event.target.value })}
            placeholder="e.g. Senior Product Designer"
          />
        </div>
        <div className="field">
          <label>Team</label>
          <select
            className="input"
            value={details.team}
            onChange={(event) => onChange({ team: event.target.value })}
          >
            <option>Product</option>
            <option>Engineering</option>
            <option>People</option>
            <option>Go to market</option>
            <option>Design</option>
            <option>Growth</option>
            <option>Platform</option>
          </select>
        </div>
        <div className="field">
          <label>Location</label>
          <input
            className="input"
            value={details.location}
            onChange={(event) => onChange({ location: event.target.value })}
            placeholder="Kuala Lumpur · Hybrid"
          />
        </div>
        <div className="field">
          <label>Employment type</label>
          <select
            className="input"
            value={details.employmentType}
            onChange={(event) => onChange({ employmentType: event.target.value })}
          >
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </div>
        <div className="field">
          <label>Salary range (annual, {details.salaryCurrency})</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={details.salaryLow ?? ""}
              onChange={(event) =>
                onChange({
                  salaryLow: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              placeholder="Low"
            />
            <span>–</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={details.salaryHigh ?? ""}
              onChange={(event) =>
                onChange({
                  salaryHigh: event.target.value === "" ? null : Number(event.target.value),
                })
              }
              placeholder="High"
            />
          </div>
        </div>
        <div className="field">
          <label>Currency</label>
          <select
            className="input"
            value={details.salaryCurrency}
            onChange={(event) => onChange({ salaryCurrency: event.target.value })}
          >
            <option>MYR</option>
            <option>USD</option>
            <option>SGD</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>Role description and outcomes</label>
        <textarea
          className="input"
          value={details.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="What will this person own, and what does success look like?"
        />
      </div>
    </section>
  );
}
