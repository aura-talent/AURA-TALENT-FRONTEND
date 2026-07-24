"use client";

import type { PhaseAutomation } from "@/app/employer/pipelineConfig";
import styles from "./PipelineTargetsSection.module.css";

/**
 * The automation-level switch, extracted so it can be surfaced on its own
 * (job-creation step 1) as well as inside PipelineTargetsSection (existing
 * per-job plan editor). Same copy, same styles, single source of truth.
 */
export default function AutomationLevelSection({
  automation,
  onChange,
}: {
  automation: PhaseAutomation;
  onChange: (automation: PhaseAutomation) => void;
}) {
  return (
    <div className={styles.autoRow}>
      <div className={styles.autoCopy}>
        <strong>Automation level</strong>
        <p>
          {automation === "auto"
            ? "Aura sources, screens, evaluates, and advances candidates through every phase on its own — stopping once it has a ranked shortlist ready for offers. You always click Send Offer yourself."
            : "You advance this job phase by phase. Aura flags when a target is met and suggests the next action, but nothing moves without you."}
        </p>
      </div>
      <div className={styles.switch} role="group" aria-label="Automation level">
        <button
          type="button"
          className={`${styles.switchBtn} ${automation === "auto" ? styles.switchActive : ""}`}
          onClick={() => onChange("auto")}
        >
          ⚡ Automatic
        </button>
        <button
          type="button"
          className={`${styles.switchBtn} ${automation === "manual" ? styles.switchActive : ""}`}
          onClick={() => onChange("manual")}
        >
          ✋ Human
        </button>
      </div>
    </div>
  );
}
