import Link from "next/link";
import SectionHeader from "./SectionHeader";
import type { JobEditorMode } from "./types";
import styles from "./JobEditor.module.css";

export default function MockInterviewSection({
  mode,
  enabled,
  customizeHref,
  onEnabledChange,
}: {
  mode: JobEditorMode;
  enabled: boolean;
  customizeHref: string;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <section className={`panel employer-section ${styles.section}`}>
      <SectionHeader
        number="02"
        title="Mock interview"
        description="Attach an employer-provided simulation to this job. Candidates may apply, interview, or complete both."
      />

      <label className={styles.interviewEnable}>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        <span className={styles.check}>✓</span>
        <span>
          <strong>Enable mock interview for this job</strong>
          <small>
            Interview evidence is optional. Candidates without an attempt can
            still be evaluated from their application profile.
          </small>
        </span>
      </label>

      {enabled &&
        (mode === "create" ? (
          <div className={`notice notice-info ${styles.notice}`}>
            <strong>Customize after creating the job. </strong>
            Once this job is created, you can add questions and tune the
            interview evaluation priorities from Interview Management.
          </div>
        ) : (
          <Link href={customizeHref} className="btn btn-ghost mt-2">
            Set up questions →
          </Link>
        ))}
    </section>
  );
}
