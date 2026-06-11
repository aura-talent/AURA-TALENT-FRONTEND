import type { Evaluation, Report } from "@/lib/schemas";

export function mockQuestions(role: string): string[] {
  return [
    `Tell me about yourself and why you're interested in this ${role} position.`,
    `Describe a challenging project you worked on as a ${role}. What was your role and the outcome?`,
    "Tell me about a time you disagreed with a teammate. How did you handle it?",
    `What do you consider the most important skill for a ${role}, and how have you developed it?`,
    "Where do you see yourself in three years, and how does this role fit that path?",
  ];
}

export function mockEvaluation(question: string): Evaluation {
  return {
    transcript:
      "Well, in my previous project I was responsible for building the user-facing dashboard. " +
      "I worked closely with the design team, and when we hit a performance problem with large " +
      "data tables I proposed virtualized rendering, which cut load time by about sixty percent.",
    scores: {
      contentRelevance: 78,
      clarityStructure: 72,
      confidenceDelivery: 68,
      bodyLanguage: 74,
    },
    overallScore: 73,
    strengths: [
      "Used a concrete project example with a measurable outcome",
      "Maintained steady eye contact through most of the answer",
    ],
    improvements: [
      `Tie the example back to the question ("${question.slice(0, 40)}…") more explicitly`,
      "Reduce filler words at the start of sentences",
    ],
    summary:
      "A solid, example-driven answer. The structure would land better with a one-line setup " +
      "before the detail, and the close could restate the impact. Non-verbal delivery was calm " +
      "with good eye contact and minimal fidgeting.",
    mocked: true,
  };
}

export function mockReport(): Report {
  return {
    averagedScores: {
      contentRelevance: 76,
      clarityStructure: 71,
      confidenceDelivery: 69,
      bodyLanguage: 75,
    },
    trend: [65, 70, 74, 72, 79],
    topStrengths: [
      "Concrete, outcome-oriented examples",
      "Consistent eye contact",
      "Calm, stable delivery",
    ],
    topImprovements: [
      "Open answers with a one-line thesis before details",
      "Reduce filler words under pressure",
      "Use hand gestures to emphasize key points",
    ],
    verdict: "promising",
    closing:
      "You improved noticeably across the session and your final answers were your strongest. " +
      "With tighter answer openings and a little more vocal energy, you would present as a " +
      "confident, well-prepared candidate.",
    mocked: true,
  };
}
