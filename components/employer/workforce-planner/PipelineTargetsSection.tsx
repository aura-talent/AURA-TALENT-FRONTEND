"use client";

import type { PhaseDef } from "@/lib/employerApi";
import {
  PHASE_METRICS,
  type JobPipelineConfig,
  type PhaseAutomation,
  type PhaseMetric,
  type PhaseTarget,
} from "@/app/employer/pipelineConfig";
import AutomationLevelSection from "./AutomationLevelSection";
import styles from "./PipelineTargetsSection.module.css";

export default function PipelineTargetsSection({
  phases,
  config,
  onChange,
  showAutomation = true,
}: {
  phases: PhaseDef[];
  config: JobPipelineConfig;
  onChange: (config: JobPipelineConfig) => void;
  /** Hide the automation switch when it's already shown elsewhere (job-creation step 1). */
  showAutomation?: boolean;
}) {
  const byId = new Map(config.phases.map((target) => [target.phaseId, target]));

  function setAutomation(automation: PhaseAutomation) {
    onChange({ ...config, automation });
  }

  function patchTarget(phaseId: string, next: Partial<PhaseTarget>) {
    onChange({
      ...config,
      phases: config.phases.map((target) =>
        target.phaseId === phaseId ? { ...target, ...next } : target,
      ),
    });
  }

  return (
    <div className={styles.wrap}>
      {/* Automation level — one switch for the whole job. Hidden when the
          host already renders it elsewhere (job-creation step 1). */}
      {showAutomation && (
        <AutomationLevelSection automation={config.automation} onChange={setAutomation} />
      )}

      {/* Targets — one per phase, defining when the job may leave it. */}
      <div className={styles.targets}>
        <div className={styles.targetsHead}>
          <span>Phase</span>
          <span>Advance when</span>
          <span>Target</span>
        </div>
        {phases.map((phase) => {
          const target = byId.get(phase.id);
          if (!target) return null;
          const manualMetric = target.metric === "manual";
          return (
            <div className={styles.targetRow} key={phase.id}>
              <div className={styles.phaseName}>
                <span
                  className={styles.dot}
                  style={{ background: phase.color }}
                  aria-hidden="true"
                />
                {phase.label}
              </div>
              <select
                className="select"
                value={target.metric}
                onChange={(event) =>
                  patchTarget(phase.id, { metric: event.target.value as PhaseMetric })
                }
              >
                {PHASE_METRICS.map((metric) => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </select>
              <input
                className="input"
                type="number"
                min="0"
                value={target.targetCount}
                disabled={manualMetric}
                onChange={(event) =>
                  patchTarget(phase.id, { targetCount: Number(event.target.value) })
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
