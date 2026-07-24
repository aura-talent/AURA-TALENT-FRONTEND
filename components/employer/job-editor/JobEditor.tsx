"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultMetricPriorities,
  defaultPipelinePhases,
  evaluationMetrics,
  scoringDimensions,
  type EvaluationMetricKey,
  type ScoringDimensionKey,
} from "@/app/employer/data";
import {
  defaultPipelineConfig,
  saveJobConfig,
  type JobPipelineConfig,
} from "@/app/employer/pipelineConfig";
import {
  employerApi,
  type EmployerHeadhunter,
  type EmployerJob,
  type JobPayload,
  type JobPlanPayload,
  type PhaseDef,
} from "@/lib/employerApi";
import HeadhunterSection from "./HeadhunterSection";
import JobAssistModal from "./JobAssistModal";
import JobDetailsSection from "./JobDetailsSection";
import KeywordsSection from "./KeywordsSection";
import MockInterviewSection from "./MockInterviewSection";
import ScoringPreview from "./ScoringPreview";
import ScoringSection from "./ScoringSection";
import JobPlanFields from "@/components/employer/workforce-planner/JobPlanFields";
import type {
  CreationAssist,
  CustomCriterion,
  DimensionWeights,
  JobDetails,
  JobEditorMode,
  MetricPriorities,
} from "./types";
import styles from "./JobEditor.module.css";

const emptyDetails: JobDetails = {
  title: "",
  team: "Product",
  location: "",
  employmentType: "Full-time",
  salaryLow: null,
  salaryHigh: null,
  salaryCurrency: "MYR",
  description: "",
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

function detailsFromJob(job: EmployerJob): JobDetails {
  return {
    title: job.title,
    team: job.team ?? "Product",
    location: job.location ?? "",
    employmentType: job.employment_type ?? "Full-time",
    salaryLow: job.salary_low,
    salaryHigh: job.salary_high,
    salaryCurrency: job.salary_currency,
    description: job.description ?? "",
  };
}

export default function JobEditor({
  mode,
  initialJob,
}: {
  mode: JobEditorMode;
  initialJob?: EmployerJob;
}) {
  const router = useRouter();
  const [creationAssist, setCreationAssist] = useState<CreationAssist | null>(
    null,
  );
  const [autoSetupInterview, setAutoSetupInterview] = useState(true);
  const [details, setDetails] = useState<JobDetails>(
    initialJob ? detailsFromJob(initialJob) : emptyDetails,
  );
  const [priorities, setPriorities] = useState<MetricPriorities>(
    () =>
      ({ ...defaultMetricPriorities, ...(initialJob?.metric_priorities ?? {}) }) as MetricPriorities,
  );
  const [dimensionWeights, setDimensionWeights] = useState<DimensionWeights>(
    () =>
      ({
        ...Object.fromEntries(
          scoringDimensions.map((dimension) => [dimension.key, dimension.weight]),
        ),
        ...(initialJob?.dimension_weights ?? {}),
      }) as DimensionWeights,
  );
  const [keywords, setKeywords] = useState<string[]>(initialJob?.keywords ?? []);
  const [keywordDraft, setKeywordDraft] = useState("");
  const [mockInterviewEnabled, setMockInterviewEnabled] = useState(
    initialJob?.mock_interview_enabled ?? true,
  );
  const [customCriteria, setCustomCriteria] = useState<CustomCriterion[]>(() =>
    (initialJob?.custom_criteria ?? []).map((criterion, index) => ({
      id: index + 1,
      name: criterion.name,
      priority: criterion.priority,
    })),
  );
  const [headhunters, setHeadhunters] = useState<EmployerHeadhunter[]>([]);
  const [headhunterIds, setHeadhunterIds] = useState<string[]>(
    initialJob?.headhunter_ids ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Create wizard: step 2 is workforce planning ──────────────────────────
  const [step, setStep] = useState(1);
  const [plan, setPlan] = useState<JobPlanPayload>(defaultPlan);
  const [phases, setPhases] = useState<PhaseDef[]>(
    defaultPipelinePhases.map((phase) => ({ ...phase })),
  );
  const [pipelineConfig, setPipelineConfig] = useState<JobPipelineConfig | null>(
    () =>
      mode === "create"
        ? defaultPipelineConfig("new", defaultPipelinePhases, defaultPlan.openings)
        : null,
  );

  useEffect(() => {
    let cancelled = false;
    employerApi
      .listHeadhunters()
      .then((data) => {
        if (!cancelled) setHeadhunters(data);
      })
      .catch((err) => console.error("Failed to load headhunters:", err));
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the wizard's phases from the employer's configured pipeline.
  useEffect(() => {
    if (mode !== "create") return;
    let cancelled = false;
    employerApi
      .getProfile()
      .then((profile) => {
        if (cancelled || !profile.hiring_pipeline_phases?.length) return;
        const next = profile.hiring_pipeline_phases.map((phase) => ({ ...phase }));
        setPhases(next);
        setPipelineConfig(defaultPipelineConfig("new", next, plan.openings));
      })
      .catch(() => {
        /* no profile yet — defaults stand */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const totalPriority = useMemo(
    () =>
      Object.values(priorities).reduce(
        (total, priority) => total + priority,
        0,
      ) +
      customCriteria.reduce(
        (total, criterion) => total + criterion.priority,
        0,
      ),
    [priorities, customCriteria],
  );
  const totalDimensionWeight = Object.values(dimensionWeights).reduce(
    (total, weight) => total + weight,
    0,
  );
  const interviewCustomizeHref = initialJob?.id
    ? `/employer/interviews/${initialJob.id}/customize`
    : "/employer/interviews";

  function addKeyword() {
    const value = keywordDraft.trim();
    if (
      !value ||
      keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())
    ) {
      return;
    }

    setKeywords((current) => [...current, value]);
    setKeywordDraft("");
  }

  function buildPayload(): JobPayload {
    return {
      title: details.title.trim() || "Untitled role",
      team: details.team,
      location: details.location,
      employment_type: details.employmentType,
      salary_low: details.salaryLow,
      salary_high: details.salaryHigh,
      salary_currency: details.salaryCurrency,
      description: details.description,
      keywords,
      mock_interview_enabled: mockInterviewEnabled,
      metric_priorities: priorities,
      dimension_weights: dimensionWeights,
      custom_criteria: customCriteria.map(({ name, priority }) => ({ name, priority })),
      headhunter_ids: headhunterIds,
    };
  }

  async function saveEdit() {
    setSaving(true);
    setError(null);
    try {
      await employerApi.updateJob(initialJob!.id, buildPayload());
      setSaved(true);
      window.setTimeout(() => router.push("/employer/jobs"), 650);
    } catch (err) {
      console.error("Failed to save job:", err);
      setError(err instanceof Error ? err.message : "Failed to save job");
      setSaving(false);
    }
  }

  // Create wizard finish: create the job, then persist its plan, the shared
  // phase list, and the pipeline targets/automation config.
  async function createWithPlan() {
    setSaving(true);
    setError(null);
    try {
      const created = await employerApi.createJob(buildPayload());
      await employerApi.upsertJobPlan(created.id, {
        ...plan,
        target_start_date: plan.target_start_date || null,
        target_fill_date: plan.target_fill_date || null,
      });
      await employerApi.upsertProfile({ hiring_pipeline_phases: phases });
      if (pipelineConfig) await saveJobConfig({ ...pipelineConfig, jobId: created.id });
      setSaved(true);
      window.setTimeout(() => router.push("/employer/jobs"), 650);
    } catch (err) {
      console.error("Failed to create job:", err);
      setError(err instanceof Error ? err.message : "Failed to create job");
      setSaving(false);
    }
  }

  function updateCriterion(
    id: number,
    update: Partial<Pick<CustomCriterion, "name" | "priority">>,
  ) {
    setCustomCriteria((current) =>
      current.map((criterion) =>
        criterion.id === id ? { ...criterion, ...update } : criterion,
      ),
    );
  }

  const isPlanningStep = mode === "create" && step === 2;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {mode === "create"
              ? `New role · Step ${step} of 2`
              : "Scoring configuration"}
          </p>
          <h1>
            {mode === "create"
              ? isPlanningStep
                ? "Plan the hire"
                : "Create a job"
              : `Edit ${initialJob?.title}`}
          </h1>
          <p>
            {isPlanningStep
              ? "Set headcount, targets, and how much of the pipeline Aura should run automatically."
              : "Define the role once, then let Aura carry the same priorities through screening, interviews, and final evaluation."}
          </p>
        </div>
        <div className={styles.headerActions}>
          {isPlanningStep ? (
            <>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button
                className="btn btn-primary"
                disabled={saving}
                onClick={createWithPlan}
              >
                {saved ? "Created ✓" : saving ? "Creating…" : "Create job & plan"}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn-ghost"
                onClick={() => router.push("/employer/jobs")}
              >
                Cancel
              </button>
              {mode === "create" ? (
                <button
                  className="btn btn-primary"
                  disabled={totalDimensionWeight !== 100}
                  onClick={() => setStep(2)}
                >
                  Next: workforce planning →
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  disabled={totalDimensionWeight !== 100 || saving}
                  onClick={saveEdit}
                >
                  {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      {isPlanningStep ? (
        <div className={styles.layout}>
          <main>
            <JobPlanFields
              plan={plan}
              onPlan={(patch) => setPlan((current) => ({ ...current, ...patch }))}
              phases={phases}
              onPhases={setPhases}
              pipelineConfig={pipelineConfig}
              onConfig={setPipelineConfig}
            />
          </main>
        </div>
      ) : (
        <div className={styles.layout}>
          <main>
            <JobDetailsSection
              mode={mode}
              details={details}
              onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
              onOpenAssist={setCreationAssist}
            />
            <MockInterviewSection
              mode={mode}
              enabled={mockInterviewEnabled}
              customizeHref={interviewCustomizeHref}
              onEnabledChange={setMockInterviewEnabled}
            />
            <KeywordsSection
              keywords={keywords}
              draft={keywordDraft}
              onDraftChange={setKeywordDraft}
              onAdd={addKeyword}
              onRemove={(keyword) =>
                setKeywords((current) =>
                  current.filter((item) => item !== keyword),
                )
              }
            />
            <ScoringSection
              priorities={priorities}
              customCriteria={customCriteria}
              dimensionWeights={dimensionWeights}
              totalPriority={totalPriority}
              totalDimensionWeight={totalDimensionWeight}
              onPriorityChange={(key: EvaluationMetricKey, value: number) =>
                setPriorities((current) => ({ ...current, [key]: value }))
              }
              onCriterionNameChange={(id, name) => updateCriterion(id, { name })}
              onCriterionPriorityChange={(id, priority) =>
                updateCriterion(id, { priority })
              }
              onCriterionRemove={(id) =>
                setCustomCriteria((current) =>
                  current.filter((criterion) => criterion.id !== id),
                )
              }
              onCriterionAdd={() =>
                setCustomCriteria((current) => [
                  ...current,
                  { id: Date.now(), name: "New criterion", priority: 5 },
                ])
              }
              onDimensionWeightChange={(
                key: ScoringDimensionKey,
                value: number,
              ) =>
                setDimensionWeights((current) => ({ ...current, [key]: value }))
              }
            />
            <HeadhunterSection
              headhunters={headhunters}
              headhunterIds={headhunterIds}
              onToggle={(headhunterId, enabled) =>
                setHeadhunterIds((current) =>
                  enabled
                    ? [...current, headhunterId]
                    : current.filter((id) => id !== headhunterId),
                )
              }
            />
          </main>

          <aside>
            <ScoringPreview
              signalCount={evaluationMetrics.length + customCriteria.length}
            />
          </aside>
        </div>
      )}

      {creationAssist && (
        <JobAssistModal
          assist={creationAssist}
          autoSetupInterview={autoSetupInterview}
          onAutoSetupInterviewChange={setAutoSetupInterview}
          onApplyDraft={(result) => {
            const d = result.draft;
            setDetails((current) => ({
              ...current,
              title: d.title ?? current.title,
              team: d.team ?? current.team,
              location: d.location ?? current.location,
              employmentType: d.employment_type ?? current.employmentType,
              salaryLow: d.salary_low ?? current.salaryLow,
              salaryHigh: d.salary_high ?? current.salaryHigh,
              salaryCurrency: d.salary_currency ?? current.salaryCurrency,
              description: d.description ?? current.description,
            }));
            if (d.keywords?.length) setKeywords(d.keywords);
            if (autoSetupInterview && result.interview_questions.length)
              setMockInterviewEnabled(true);
          }}
          onClose={() => setCreationAssist(null)}
        />
      )}
    </div>
  );
}
