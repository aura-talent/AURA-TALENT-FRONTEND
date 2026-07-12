"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { planStatusChipClass, type PlanStatus } from "@/app/employer/data";
import {
  employerApi,
  type EmployerJob,
  type EmployerJobPlan,
  type JobPlanPayload,
  type PhaseDef,
} from "@/lib/employerApi";
import SectionHeader from "@/components/employer/job-editor/SectionHeader";
import jobEditorStyles from "@/components/employer/job-editor/JobEditor.module.css";
import PlanForecast from "./PlanForecast";
import PlanAuraModal from "./PlanAuraModal";
import styles from "./WorkforcePlanner.module.css";

const statusOptions: PlanStatus[] = ["Draft", "Approved", "Published"];

const statusHints: Record<PlanStatus, string> = {
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

const defaultPlan: JobPlanPayload = {
  status: "Draft",
  priority: "Medium",
  backfill: false,
  openings: 1,
  baseline_headcount: 0,
  budget: 0,
  hiring_manager: "",
  target_start_date: null,
  target_fill_date: null,
  justification: "",
  demand_signal_reason: "",
  demand_signal_risk: "Medium",
};

function planToForm(plan: EmployerJobPlan): JobPlanPayload {
  return {
    status: plan.status,
    priority: plan.priority ?? "Medium",
    backfill: plan.backfill,
    openings: plan.openings,
    baseline_headcount: plan.baseline_headcount ?? 0,
    budget: plan.budget ?? 0,
    hiring_manager: plan.hiring_manager ?? "",
    target_start_date: plan.target_start_date,
    target_fill_date: plan.target_fill_date,
    justification: plan.justification ?? "",
    demand_signal_reason: plan.demand_signal_reason ?? "",
    demand_signal_risk: plan.demand_signal_risk ?? "Medium",
  };
}

export default function JobPlanEditor({
  job,
  initialPlan,
  phases,
}: {
  job: EmployerJob;
  initialPlan: EmployerJobPlan | null;
  phases: PhaseDef[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<JobPlanPayload>(
    initialPlan ? planToForm(initialPlan) : defaultPlan,
  );
  const [showAuraModal, setShowAuraModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(patch: Partial<JobPlanPayload>) {
    setPlan((current) => ({ ...current, ...patch }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await employerApi.upsertJobPlan(job.id, {
        ...plan,
        target_start_date: plan.target_start_date || null,
        target_fill_date: plan.target_fill_date || null,
      });
      setSaved(true);
      window.setTimeout(() => router.push("/employer/workforce"), 650);
    } catch (err) {
      console.error("Failed to save plan:", err);
      setError(err instanceof Error ? err.message : "Failed to save plan");
      setSaving(false);
    }
  }

  const phase = phases.find((item) => item.id === job.pipeline_phase);

  return (
    <div className="employer-page">
      <Link href="/employer/workforce" className="back-link">
        ← Workforce planning
      </Link>

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Workforce plan</p>
          <h1>{job.title}</h1>
          <p>
            Set headcount, budget, and hiring demand for this role. Aura
            updates the forecast as your assumptions change.
          </p>
        </div>
        <div className={jobEditorStyles.headerActions}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setShowAuraModal(true)}
          >
            <Sparkles size={15} /> Generate with Aura
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={save}
            disabled={saving}
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save plan"}
          </button>
        </div>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className={jobEditorStyles.layout}>
        <main>
          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="01"
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
                  onChange={(event) =>
                    update({ openings: Number(event.target.value) })
                  }
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
                    update({ baseline_headcount: Number(event.target.value) })
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
                  onChange={(event) =>
                    update({ budget: Number(event.target.value) })
                  }
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
                      onClick={() => update({ priority: option })}
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
                  onChange={(event) =>
                    update({ backfill: event.target.checked })
                  }
                />
                <span>This is a backfill for someone leaving</span>
              </label>
            </div>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="02"
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
                    update({ target_start_date: event.target.value || null })
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
                    update({ target_fill_date: event.target.value || null })
                  }
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Hiring manager</span>
              <input
                className="input"
                value={plan.hiring_manager ?? ""}
                onChange={(event) =>
                  update({ hiring_manager: event.target.value })
                }
                placeholder="Who owns this requisition"
              />
            </label>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="03"
              title="Business case"
              description="Why this role is needed, for internal approval."
            />
            <label className={styles.field}>
              <textarea
                className="input"
                style={{ minHeight: "110px" }}
                value={plan.justification ?? ""}
                onChange={(event) =>
                  update({ justification: event.target.value })
                }
                placeholder="Explain the business need for this headcount..."
              />
            </label>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="04"
              title="Demand signal"
              description="Aura's read on urgency, or your own risk assessment."
            />
            <label className={styles.field}>
              <span>Reason</span>
              <textarea
                className="input"
                style={{ minHeight: "80px" }}
                value={plan.demand_signal_reason ?? ""}
                onChange={(event) =>
                  update({ demand_signal_reason: event.target.value })
                }
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
                    onClick={() => update({ demand_signal_risk: option })}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="05"
              title="Status"
              description="Draft while defining, approved once budgeted, published when live."
            />
            <div className={styles.pillOptions}>
              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${styles.pillOption} ${plan.status === option ? planStatusChipClass(option) : ""}`}
                  onClick={() => update({ status: option })}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className={styles.statusHint}>{statusHints[plan.status]}</p>
          </section>
        </main>

        <aside>
          <PlanForecast plan={plan} />

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <p className="eyebrow">In the hiring pipeline</p>
            <div className={styles.pipelineContext}>
              <span
                className="chip"
                style={{
                  background: `color-mix(in srgb, ${phase?.color ?? "#64748b"} 14%, transparent)`,
                  color: phase?.color ?? "#64748b",
                }}
              >
                {phase?.label ?? "Unassigned"}
              </span>
              <span className={`chip ${planStatusChipClass(plan.status)}`}>
                Plan: {plan.status}
              </span>
            </div>
            <p className={styles.previewNote}>
              This job listing&apos;s board card lives in the {phase?.label ?? "current"}{" "}
              column. Publish this plan once budget is approved to keep it in
              sync.
            </p>
            <Link href="/employer" className="table-action">
              View hiring pipeline →
            </Link>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <p className="eyebrow">Job listing</p>
            <div className={styles.jobSummary}>
              <strong>{job.title}</strong>
              <span className={`chip ${job.status === "Active" ? "chip-tier-high" : ""}`}>
                {job.status}
              </span>
            </div>
            <p className={styles.previewNote}>
              {job.stats?.applicant_count ?? 0} candidate{(job.stats?.applicant_count ?? 0) === 1 ? "" : "s"} ·{" "}
              {job.location ?? "—"}
            </p>
            <Link href={`/employer/jobs/${job.id}`} className="table-action">
              View job listing →
            </Link>
          </section>
        </aside>
      </div>

      {showAuraModal && (
        <PlanAuraModal
          jobTitle={job.title}
          onGenerate={update}
          onClose={() => setShowAuraModal(false)}
        />
      )}
    </div>
  );
}
