import type { Evaluation, Telemetry } from "@/lib/schemas";

export function questionsPrompt(role: string): { system: string; user: string } {
  return {
    system:
      "You are an experienced hiring manager conducting a mock interview. " +
      'Respond ONLY with JSON: {"questions": [string, string, string, string, string]}. ' +
      "Exactly 5 questions: 1 introduction, 2 behavioral, 2 role-specific. " +
      "Questions must be answerable verbally in 1-2 minutes.",
    user: `Generate 5 interview questions for a candidate applying for: ${role}`,
  };
}

export function evaluatePrompt(
  role: string,
  question: string,
  transcript: string,
  telemetry: Telemetry | null,
): { system: string; user: string } {
  return {
    system:
      "You are an expert interview coach evaluating a mock-interview answer. " +
      "Respond ONLY with JSON matching exactly this shape: " +
      '{"scores": {"contentRelevance": 0-100, "clarityStructure": 0-100, ' +
      '"confidenceDelivery": 0-100, "bodyLanguage": 0-100}, "overallScore": 0-100, ' +
      '"strengths": [string, ...], "improvements": [string, ...], "summary": string}. ' +
      "Score contentRelevance, clarityStructure and confidenceDelivery from the transcript. " +
      "Score bodyLanguage ONLY from the telemetry data. " +
      (telemetry === null
        ? "Telemetry is unavailable: set bodyLanguage to 50 and do not comment on body language."
        : "") +
      " Give 2-3 strengths and 2-3 improvements. Summary is one coaching paragraph. " +
      "Be specific and constructive; reference what the candidate actually said.",
    user:
      `Role: ${role}\nQuestion: ${question}\nTranscript: ${transcript}\n` +
      `Non-verbal telemetry: ${JSON.stringify(telemetry)}`,
  };
}

export function reportPrompt(
  role: string,
  answers: { question: string; evaluation: Evaluation }[],
): { system: string; user: string } {
  return {
    system:
      "You are an expert interview coach writing a final mock-interview report. " +
      "Respond ONLY with JSON matching exactly this shape: " +
      '{"averagedScores": {"contentRelevance": n, "clarityStructure": n, ' +
      '"confidenceDelivery": n, "bodyLanguage": n}, "trend": [n per question], ' +
      '"topStrengths": [up to 3 strings], "topImprovements": [up to 3 strings], ' +
      '"verdict": "strong" | "promising" | "needs practice", "closing": string}. ' +
      "averagedScores are the means of the per-question scores. trend is the overallScore " +
      "per question in order. The closing is one encouraging, honest paragraph.",
    user:
      `Role: ${role}\n` +
      answers
        .map(
          (a, i) =>
            `Q${i + 1}: ${a.question}\nScores: ${JSON.stringify(a.evaluation.scores)}\n` +
            `Overall: ${a.evaluation.overallScore}\nSummary: ${a.evaluation.summary}`,
        )
        .join("\n\n"),
  };
}
