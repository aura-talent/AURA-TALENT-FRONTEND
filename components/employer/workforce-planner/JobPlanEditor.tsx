"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { planStatusChipClass } from "@/app/employer/data";
import {
  getJobConfig,
  saveJobConfig,
  type JobPipelineConfig,
} from "@/app/employer/pipelineConfig";
import {
  employerApi,
  type EmployerJob,
  type EmployerJobPlan,
  type JobPlanPayload,
  type PhaseDef,
} from "@/lib/employerApi";
import jobEditorStyles from "@/components/employer/job-editor/JobEditor.module.css";
import PlanForecast from "./PlanForecast";
import PlanAuraModal from "./PlanAuraModal";
import JobPlanFields from "./JobPlanFields";
import styles from "./WorkforcePlanner.module.css";

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
  phases: initialPhases,
}: {
  job: EmployerJob;
  initialPlan: EmployerJobPlan | null;
  phases: PhaseDef[];
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<JobPlanPayload>(
    initialPlan ? planToForm(initialPlan) : defaultPlan,
  );
  // Phases are employer-wide (profile), but edited here so planning is the one
  // centralized place for the pipeline. Local until save.
  const [phases, setPhases] = useState<PhaseDef[]>(
    initialPhases.map((phase) => ({ ...phase })),
  );
  const [pipelineConfig, setPipelineConfig] = useState<JobPipelineConfig | null>(null);
  const [showAuraModal, setShowAuraModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipeline targets/automation derive from the job row (automation_level,
  // phase_targets) — initialize the editable config from it on mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPipelineConfig(
      getJobConfig(job, initialPhases, initialPlan?.openings ?? plan.openings),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

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
      await employerApi.upsertProfile({ hiring_pipeline_phases: phases });
      if (pipelineConfig) await saveJobConfig(pipelineConfig);
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
          <JobPlanFields
            plan={plan}
            onPlan={update}
            phases={phases}
            onPhases={setPhases}
            pipelineConfig={pipelineConfig}
            onConfig={setPipelineConfig}
          />
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
          jobId={job.id}
          jobTitle={job.title}
          onGenerate={update}
          onClose={() => setShowAuraModal(false)}
        />
      )}
    </div>
  );
}
