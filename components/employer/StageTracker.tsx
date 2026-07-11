"use client";

import { useState, type CSSProperties } from "react";
import { stageColors, stagePipeline, type Stage } from "@/app/employer/data";
import styles from "./StageTracker.module.css";

export default function StageTracker({
  initialStage,
}: {
  initialStage: string;
}) {
  const [stage, setStage] = useState<Stage>(initialStage as Stage);
  const isRejected = stage === "Rejected";
  const currentIndex = stagePipeline.indexOf(
    stage as (typeof stagePipeline)[number],
  );

  return (
    <div className={styles.tracker} role="group" aria-label="Application stage">
      <ol className={styles.steps}>
        {stagePipeline.map((step, index) => {
          const done = !isRejected && index <= currentIndex;
          const isCurrent = !isRejected && index === currentIndex;
          return (
            <li className={styles.stepWrap} key={step}>
              {index > 0 && (
                <span
                  className={`${styles.connector} ${!isRejected && index <= currentIndex ? styles.connectorDone : ""}`}
                />
              )}
              <button
                type="button"
                className={`${styles.step} ${isCurrent ? styles.stepCurrent : ""}`}
                style={{ "--step-c": stageColors[step] } as CSSProperties}
                onClick={() => setStage(step)}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className={`${styles.dot} ${done ? styles.dotDone : ""}`} />
                <span className={`${styles.label} ${done ? styles.labelDone : ""}`}>
                  {step}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <span className={styles.divider} aria-hidden="true" />

      <button
        type="button"
        className={`${styles.rejected} ${isRejected ? styles.rejectedActive : ""}`}
        style={{ "--step-c": stageColors.Rejected } as CSSProperties}
        onClick={() => setStage("Rejected")}
      >
        ✕ Rejected
      </button>
    </div>
  );
}
