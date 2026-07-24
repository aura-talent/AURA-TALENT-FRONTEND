"use client";

import { planStatusChipClass, type PlanStatus } from "@/app/employer/data";
import {
  defaultPipelineConfig,
  type JobPipelineConfig,
} from "@/app/employer/pipelineConfig";
import type { JobPlanPayload, PhaseDef } from "@/lib/employerApi";
import SectionHeader from "@/components/employer/job-editor/SectionHeader";
import jobEditorStyles from "@/components/employer/job-editor/JobEditor.module.css";
import PipelineListEditor from "@/components/employer/PipelineListEditor";
import PipelineTargetsSection from "./PipelineTargetsSection";
import styles from "./WorkforcePlanner.module.css";

export const planStatusOptions: PlanStatus[] = ["Draft", "Approved", "Published"];

export const planStatusHints: Record<PlanStatus, string> = {
  Draft: "Still being defined. Not visible outside your planning team.",
  Approved: "Headcount and budget are approved and ready to open.",
  Published: "Live and reflected in this job's hiring pipeline phase.",
};

const priorityOptions = ["High", "Medium", "Low"];
const riskOptions = ["High", "Medium", "Covered"];

const riskClass: Record<string, string> = {
  High: styles.riskHigh,
  Medium: styles.riskMedium,
  Covered: styles.riskLow,
};

const PHASE_SWATCHES = [
  "#475569", "#2563eb", "#4f46e5", "#7c3aed",
  "#d97706", "#0d9488", "#16a34a", "#0891b2",
];

function newPhaseId() {
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * The workforce-plan form body (sections 01–07). Presentational: the parent
 * owns plan / phases / pipelineConfig state and persistence. Shared by the
 * standalone plan editor and the job-creation wizard's step 2.
 */
export default function JobPlanFields({
  plan,
  onPlan,
  phases,
  onPhases,
  pipelineConfig,
  onConfig,
  startNumber = 1,
  hideAutomation = false,
}: {
  plan: JobPlanPayload;
  onPlan: (patch: Partial<JobPlanPayload>) => void;
  phases: PhaseDef[];
  onPhases: (phases: PhaseDef[]) => void;
  pipelineConfig: JobPipelineConfig | null;
  onConfig: (config: JobPipelineConfig) => void;
  /** First section number, so a host can offset the numbering. */
  startNumber?: number;
  /** Hide the automation switch when the host already shows it elsewhere (job-creation step 1). */
  hideAutomation?: boolean;
}) {
  const num = (offset: number) => String(startNumber + offset).padStart(2, "0");

  // Editing the phase list re-aligns per-phase targets: kept by phase id,
  // defaults filled in for new phases, dropped for removed ones.
  function handlePhasesChange(next: PhaseDef[]) {
    onPhases(next);
    if (!pipelineConfig) return;
    const fresh = defaultPipelineConfig(pipelineConfig.jobId, next, plan.openings);
    const byId = new Map(pipelineConfig.phases.map((t) => [t.phaseId, t]));
    onConfig({
      ...pipelineConfig,
      phases: fresh.phases.map((f) => byId.get(f.phaseId) ?? f),
    });
  }

  return (
    <>
      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(0)}
          title="Headcount & budget"
          description="How many openings, and what they'll cost against the current team."
        />
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Openings</span>
            <input
              className="input"
              type="number"
              min="0"
              value={plan.openings}
              onChange={(event) => onPlan({ openings: Number(event.target.value) })}
            />
          </label>
          <label className={styles.field}>
            <span>Current team headcount</span>
            <input
              className="input"
              type="number"
              min="0"
              value={plan.baseline_headcount ?? 0}
              onChange={(event) =>
                onPlan({ baseline_headcount: Number(event.target.value) })
              }
            />
          </label>
        </div>
        <label className={styles.field}>
          <span>Annual budget for this role</span>
          <div className={styles.currencyInput}>
            <b>RM</b>
            <input
              type="number"
              min="0"
              step="1000"
              value={plan.budget ?? 0}
              onChange={(event) => onPlan({ budget: Number(event.target.value) })}
            />
          </div>
        </label>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <span>Priority</span>
            <div className={styles.pillOptions}>
              {priorityOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${styles.pillOption} ${plan.priority === option ? styles.pillOptionActive : ""}`}
                  onClick={() => onPlan({ priority: option })}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.checkboxField}>
            <input
              type="checkbox"
              checked={plan.backfill}
              onChange={(event) => onPlan({ backfill: event.target.checked })}
            />
            <span>This is a backfill for someone leaving</span>
          </label>
        </div>
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(1)}
          title="Timeline & ownership"
          description="When this role needs to start and fill, and who owns it."
        />
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>Target start</span>
            <input
              className="input"
              type="date"
              value={plan.target_start_date ?? ""}
              onChange={(event) =>
                onPlan({ target_start_date: event.target.value || null })
              }
            />
          </label>
          <label className={styles.field}>
            <span>Target fill date</span>
            <input
              className="input"
              type="date"
              value={plan.target_fill_date ?? ""}
              onChange={(event) =>
                onPlan({ target_fill_date: event.target.value || null })
              }
            />
          </label>
        </div>
        <label className={styles.field}>
          <span>Hiring manager</span>
          <input
            className="input"
            value={plan.hiring_manager ?? ""}
            onChange={(event) => onPlan({ hiring_manager: event.target.value })}
            placeholder="Who owns this requisition"
          />
        </label>
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(2)}
          title="Business case"
          description="Why this role is needed, for internal approval."
        />
        <label className={styles.field}>
          <textarea
            className="input"
            style={{ minHeight: "110px" }}
            value={plan.justification ?? ""}
            onChange={(event) => onPlan({ justification: event.target.value })}
            placeholder="Explain the business need for this headcount..."
          />
        </label>
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(3)}
          title="Demand signal"
          description="Aura's read on urgency, or your own risk assessment."
        />
        <label className={styles.field}>
          <span>Reason</span>
          <textarea
            className="input"
            style={{ minHeight: "80px" }}
            value={plan.demand_signal_reason ?? ""}
            onChange={(event) => onPlan({ demand_signal_reason: event.target.value })}
            placeholder="What's driving the hiring pressure on this role?"
          />
        </label>
        <div className={styles.field}>
          <span>Risk</span>
          <div className={styles.pillOptions}>
            {riskOptions.map((option) => (
              <button
                key={option}
                type="button"
                className={`chip ${styles.pillOption} ${plan.demand_signal_risk === option ? riskClass[option] : ""}`}
                onClick={() => onPlan({ demand_signal_risk: option })}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(4)}
          title="Status"
          description="Draft while defining, approved once budgeted, published when live."
        />
        <div className={styles.pillOptions}>
          {planStatusOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`chip ${styles.pillOption} ${plan.status === option ? planStatusChipClass(option) : ""}`}
              onClick={() => onPlan({ status: option })}
            >
              {option}
            </button>
          ))}
        </div>
        <p className={styles.statusHint}>{planStatusHints[plan.status]}</p>
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(5)}
          title="Hiring pipeline phases"
          description="The columns every job listing moves through on the pipeline board. Reorder, rename, recolor, add, or remove — this applies across your whole workspace."
        />
        <PipelineListEditor
          items={phases}
          onChange={handlePhasesChange}
          addLabel="Add phase"
          createItem={() => ({
            id: newPhaseId(),
            label: "New phase",
            color: PHASE_SWATCHES[phases.length % PHASE_SWATCHES.length],
          })}
        />
      </section>

      <section className={`panel employer-section ${jobEditorStyles.section}`}>
        <SectionHeader
          number={num(6)}
          title={hideAutomation ? "Phase targets" : "Automation & targets"}
          description={
            hideAutomation
              ? "Set the target that lets this job leave each phase — automation level is set above, in step 1."
              : "Choose whether Aura advances this job automatically or waits for you, and set the target that lets it leave each phase."
          }
        />
        {pipelineConfig ? (
          <PipelineTargetsSection
            phases={phases}
            config={pipelineConfig}
            onChange={onConfig}
            showAutomation={!hideAutomation}
          />
        ) : (
          <p className={styles.statusHint}>Loading pipeline targets…</p>
        )}
      </section>
    </>
  );
}
