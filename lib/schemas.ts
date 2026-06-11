import { z } from "zod";

export const TelemetrySchema = z.object({
  eyeContactPercentage: z.number().min(0).max(100),
  gazeDeviationsCount: z.number().int().min(0),
  headPoseInstability: z.enum(["low", "moderate", "high"]),
  handGestureFrequency: z.enum(["none", "low", "moderate", "high"]),
});
export type Telemetry = z.infer<typeof TelemetrySchema>;

export const ScoresSchema = z.object({
  contentRelevance: z.number().min(0).max(100),
  clarityStructure: z.number().min(0).max(100),
  confidenceDelivery: z.number().min(0).max(100),
  bodyLanguage: z.number().min(0).max(100),
});
export type Scores = z.infer<typeof ScoresSchema>;

export const EvaluationSchema = z.object({
  transcript: z.string(),
  scores: ScoresSchema,
  overallScore: z.number().min(0).max(100),
  strengths: z.array(z.string()).min(1),
  improvements: z.array(z.string()).min(1),
  summary: z.string(),
  mocked: z.boolean(),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;

export const ReportSchema = z.object({
  averagedScores: ScoresSchema,
  trend: z.array(z.number().min(0).max(100)).min(1),
  topStrengths: z.array(z.string()).min(1).max(3),
  topImprovements: z.array(z.string()).min(1).max(3),
  verdict: z.enum(["strong", "promising", "needs practice"]),
  closing: z.string(),
  mocked: z.boolean(),
});
export type Report = z.infer<typeof ReportSchema>;

export const QuestionsResponseSchema = z.object({
  questions: z.array(z.string().min(1)).length(5),
  mocked: z.boolean(),
});
export type QuestionsResponse = z.infer<typeof QuestionsResponseSchema>;

// What the LLM itself must return (server adds transcript/mocked).
export const QuestionsLLMSchema = z.object({
  questions: z.array(z.string().min(1)).length(5),
});
export const EvaluationLLMSchema = EvaluationSchema.omit({
  transcript: true,
  mocked: true,
});
export const ReportLLMSchema = ReportSchema.omit({ mocked: true });
