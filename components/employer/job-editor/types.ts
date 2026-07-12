import type {
  EvaluationMetricKey,
  ScoringDimensionKey,
} from "@/app/employer/data";

export type JobEditorMode = "create" | "edit";
export type CreationAssist = "aura" | "url";

/** Controlled form state for the job-details section. */
export type JobDetails = {
  title: string;
  team: string;
  location: string;
  employmentType: string;
  salaryLow: number | null;
  salaryHigh: number | null;
  salaryCurrency: string;
  description: string;
};

export type CustomCriterion = {
  id: number;
  name: string;
  priority: number;
};

export type MetricPriorities = Record<EvaluationMetricKey, number>;
export type DimensionWeights = Record<ScoringDimensionKey, number>;
