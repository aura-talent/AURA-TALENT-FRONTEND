"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import {
  jobs,
  jobPlans,
  pipelinePhases,
  planStatusChipClass,
  type JobPlan,
  type PlanStatus,
} from "@/app/employer/data";
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

const priorityOptions: JobPlan["priority"][] = ["High", "Medium", "Low"];
const riskOptions: JobPlan["demandSignal"]["risk"][] = [
  "High",
  "Medium",
  "Covered",
];

const riskClass: Record<JobPlan["demandSignal"]["risk"], string> = {
  High: styles.riskHigh,
  Medium: styles.riskMedium,
  Covered: styles.riskLow,
};

const defaultPlan: JobPlan = {
  status: "Draft",
  priority: "Medium",
  backfill: false,
  openings: 1,
  baselineHeadcount: 0,
  budget: 0,
  hiringManager: "",
  targetStartDate: "",
  targetFillDate: "",
  justification: "",
  demandSignal: { reason: "", risk: "Medium" },
  lastUpdated: "Never",
};

export default function JobPlanEditor({ jobId }: { jobId: string }) {
  const router = useRouter();
  const job = jobs.find((item) => item.id === jobId)!;
  const [plan, setPlan] = useState<JobPlan>(jobPlans[jobId] ?? defaultPlan);
  const [showAuraModal, setShowAuraModal] = useState(false);
  const [saved, setSaved] = useState(false);

  function update(patch: Partial<JobPlan>) {
    setPlan((current) => ({ ...current, ...patch }));
  }

  function save() {
    setSaved(true);
    window.setTimeout(() => router.push("/employer/workforce"), 650);
  }

  const phase = pipelinePhases.find((item) => item.id === job.pipelinePhase);

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
          <button className="btn btn-primary" type="button" onClick={save}>
            {saved ? "Saved ✓" : "Save plan"}
          </button>
        </div>
      </div>

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
                  value={plan.baselineHeadcount}
                  onChange={(event) =>
                    update({ baselineHeadcount: Number(event.target.value) })
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
                  value={plan.budget}
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
                  value={plan.targetStartDate}
                  onChange={(event) =>
                    update({ targetStartDate: event.target.value })
                  }
                  placeholder="e.g. Jun 2026"
                />
              </label>
              <label className={styles.field}>
                <span>Target fill date</span>
                <input
                  className="input"
                  value={plan.targetFillDate}
                  onChange={(event) =>
                    update({ targetFillDate: event.target.value })
                  }
                  placeholder="e.g. Sep 2026"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Hiring manager</span>
              <input
                className="input"
                value={plan.hiringManager}
                onChange={(event) =>
                  update({ hiringManager: event.target.value })
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
                value={plan.justification}
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
                value={plan.demandSignal.reason}
                onChange={(event) =>
                  update({
                    demandSignal: {
                      ...plan.demandSignal,
                      reason: event.target.value,
                    },
                  })
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
                    className={`chip ${styles.pillOption} ${plan.demandSignal.risk === option ? riskClass[option] : ""}`}
                    onClick={() =>
                      update({
                        demandSignal: { ...plan.demandSignal, risk: option },
                      })
                    }
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
              {job.candidates} candidate{job.candidates === 1 ? "" : "s"} ·{" "}
              {job.location}
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
