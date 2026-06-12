import SectionHeader from "./SectionHeader";
import type { CreationAssist, JobEditorMode, JobSeed } from "./types";
import styles from "./JobEditor.module.css";

export default function JobDetailsSection({
  mode,
  initialJob,
  onOpenAssist,
}: {
  mode: JobEditorMode;
  initialJob: JobSeed;
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
            defaultValue={initialJob.title}
            placeholder="e.g. Senior Product Designer"
          />
        </div>
        <div className="field">
          <label>Team</label>
          <select className="input" defaultValue={initialJob.team ?? "Product"}>
            <option>Product</option>
            <option>Engineering</option>
            <option>People</option>
            <option>Go to market</option>
          </select>
        </div>
        <div className="field">
          <label>Location</label>
          <input
            className="input"
            defaultValue={initialJob.location}
            placeholder="Kuala Lumpur · Hybrid"
          />
        </div>
        <div className="field">
          <label>Employment type</label>
          <select
            className="input"
            defaultValue={initialJob.employmentType ?? "Full-time"}
          >
            <option>Full-time</option>
            <option>Part-time</option>
            <option>Contract</option>
            <option>Internship</option>
          </select>
        </div>
        <div className="field">
          <label>Compensation / allowance</label>
          <input
            className="input"
            defaultValue={initialJob.salary}
            placeholder="RM 12,000–16,000 / month"
          />
        </div>
        <div className="field">
          <label>Hiring target</label>
          <input className="input" type="number" min="1" defaultValue="2" />
        </div>
      </div>

      <div className="field">
        <label>Role description and outcomes</label>
        <textarea
          className="input"
          defaultValue={initialJob.description}
          placeholder="What will this person own, and what does success look like?"
        />
      </div>
    </section>
  );
}
