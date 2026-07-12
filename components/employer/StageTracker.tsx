"use client";

import { useState, type CSSProperties } from "react";
import type { StageDef } from "@/lib/employerApi";
import styles from "./StageTracker.module.css";

/** Clickable stepper over a job's configured stage list. Non-rejected
 * stages form the sequence; the (first) is_rejected stage renders as the
 * terminal branch. onStageChange persists the move — the tracker updates
 * optimistically and reverts if the callback throws. */
export default function StageTracker({
  initialStage,
  stages,
  onStageChange,
}: {
  initialStage: string;
  stages: StageDef[];
  onStageChange?: (stage: string) => Promise<void> | void;
}) {
  const [stage, setStage] = useState(initialStage);
  const steps = stages.filter((s) => !s.is_rejected);
  const rejected = stages.find((s) => s.is_rejected);
  const isRejected = stage === rejected?.label;
  const currentIndex = steps.findIndex((step) => step.label === stage);

  async function select(label: string) {
    const previous = stage;
    setStage(label);
    try {
      await onStageChange?.(label);
    } catch (err) {
      console.error("Failed to move stage:", err);
      setStage(previous);
    }
  }

  return (
    <div className={styles.tracker} role="group" aria-label="Application stage">
      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const done = !isRejected && index <= currentIndex;
          const isCurrent = !isRejected && index === currentIndex;
          return (
            <li className={styles.stepWrap} key={step.label}>
              {index > 0 && (
                <span
                  className={`${styles.connector} ${!isRejected && index <= currentIndex ? styles.connectorDone : ""}`}
                />
              )}
              <button
                type="button"
                className={`${styles.step} ${isCurrent ? styles.stepCurrent : ""}`}
                style={{ "--step-c": step.color } as CSSProperties}
                onClick={() => select(step.label)}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={`${styles.dot} ${done ? styles.dotDone : ""}`} />
                <span className={`${styles.label} ${done ? styles.labelDone : ""}`}>
                  {step.label}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {rejected && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={`${styles.rejected} ${isRejected ? styles.rejectedActive : ""}`}
            style={{ "--step-c": rejected.color } as CSSProperties}
            onClick={() => select(rejected.label)}
          >
            ✕ {rejected.label}
          </button>
        </>
      )}
    </div>
  );
}
