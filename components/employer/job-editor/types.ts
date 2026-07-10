import type {
  EvaluationMetricKey,
  ScoringDimensionKey,
} from "@/app/employer/data";

export type JobEditorMode = "create" | "edit";
export type CreationAssist = "aura" | "url";

export type JobSeed = {
  id?: string;
  title?: string;
  team?: string;
  location?: string;
  employmentType?: string;
  salary?: string;
  description?: string;
  keywords?: string[];
  mockInterviewEnabled?: boolean;
  interviewQuestions?: number;
  headhunterIds?: string[];
};

export type CustomCriterion = {
  id: number;
  name: string;
  priority: number;
};

export type MetricPriorities = Record<EvaluationMetricKey, number>;
export type DimensionWeights = Record<ScoringDimensionKey, number>;
