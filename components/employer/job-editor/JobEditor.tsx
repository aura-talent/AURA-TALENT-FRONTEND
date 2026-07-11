"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  defaultMetricPriorities,
  evaluationMetrics,
  scoringDimensions,
  type EvaluationMetricKey,
  type ScoringDimensionKey,
} from "@/app/employer/data";
import HeadhunterSection from "./HeadhunterSection";
import JobAssistModal from "./JobAssistModal";
import JobDetailsSection from "./JobDetailsSection";
import KeywordsSection from "./KeywordsSection";
import MockInterviewSection from "./MockInterviewSection";
import ScoringPreview from "./ScoringPreview";
import ScoringSection from "./ScoringSection";
import type {
  CreationAssist,
  CustomCriterion,
  DimensionWeights,
  JobEditorMode,
  JobSeed,
  MetricPriorities,
} from "./types";
import styles from "./JobEditor.module.css";

export default function JobEditor({
  mode,
  initialJob = {},
}: {
  mode: JobEditorMode;
  initialJob?: JobSeed;
}) {
  const router = useRouter();
  const [creationAssist, setCreationAssist] = useState<CreationAssist | null>(
    null,
  );
  const [autoSetupInterview, setAutoSetupInterview] = useState(true);
  const [priorities, setPriorities] = useState<MetricPriorities>(
    defaultMetricPriorities,
  );
  const [dimensionWeights, setDimensionWeights] = useState<DimensionWeights>(
    () =>
      Object.fromEntries(
        scoringDimensions.map((dimension) => [dimension.key, dimension.weight]),
      ) as DimensionWeights,
  );
  const [keywords, setKeywords] = useState(
    initialJob.keywords ?? ["product strategy", "design systems"],
  );
  const [keywordDraft, setKeywordDraft] = useState("");
  const [mockInterviewEnabled, setMockInterviewEnabled] = useState(
    initialJob.mockInterviewEnabled ?? true,
  );
  const [customCriteria, setCustomCriteria] = useState<CustomCriterion[]>([
    { id: 1, name: "Portfolio evidence", priority: 8 },
  ]);
  const [headhunterIds, setHeadhunterIds] = useState<string[]>(
    initialJob.headhunterIds ?? [],
  );
  const [saved, setSaved] = useState(false);

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
  const interviewCustomizeHref = initialJob.id
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

  function saveJob() {
    setSaved(true);
    window.setTimeout(() => router.push("/employer/jobs"), 650);
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

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {mode === "create" ? "New role" : "Scoring configuration"}
          </p>
          <h1>
            {mode === "create" ? "Create a job" : `Edit ${initialJob.title}`}
          </h1>
          <p>
            Define the role once, then let Aura carry the same priorities
            through screening, interviews, and final evaluation.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-ghost"
            onClick={() => router.push("/employer/jobs")}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={totalDimensionWeight !== 100}
            onClick={saveJob}
          >
            {saved
              ? "Saved ✓"
              : mode === "create"
                ? "Create job"
                : "Save changes"}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <main>
          <JobDetailsSection
            mode={mode}
            initialJob={initialJob}
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

      {creationAssist && (
        <JobAssistModal
          assist={creationAssist}
          autoSetupInterview={autoSetupInterview}
          onAutoSetupInterviewChange={setAutoSetupInterview}
          onClose={() => setCreationAssist(null)}
        />
      )}
    </div>
  );
}
