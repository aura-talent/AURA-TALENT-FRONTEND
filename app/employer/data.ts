export type EvaluationMetricKey =
  | "reputation"
  | "match"
  | "northStar"
  | "compensation"
  | "culture"
  | "redFlags";

export const evaluationMetrics: Array<{
  key: EvaluationMetricKey;
  label: string;
  description: string;
}> = [
  { key: "reputation", label: "Reputational score", description: "Mock interview performance and evidence quality" },
  { key: "match", label: "ATS & keyword match", description: "Resume evidence against prioritized role keywords" },
  { key: "northStar", label: "North Star alignment", description: "Career direction, motivation, and role outcomes" },
  { key: "compensation", label: "Compensation / allowance", description: "Salary expectations and total package alignment" },
  { key: "culture", label: "Cultural alignment", description: "Team behaviors and system alignment" },
  { key: "redFlags", label: "Red flag confidence", description: "Risk checks; a higher score means lower observed risk" },
];

export const defaultMetricPriorities: Record<EvaluationMetricKey, number> = {
  reputation: 9,
  match: 10,
  northStar: 9,
  compensation: 7,
  culture: 8,
  redFlags: 8,
};

export type ScoringDimensionKey = "technical" | "problemSolving" | "communication" | "culture";

export const scoringDimensions: Array<{
  key: ScoringDimensionKey;
  label: string;
  weight: number;
  description: string;
}> = [
  { key: "technical", label: "Technical core", weight: 38, description: "Role knowledge, skills, and quality of technical evidence" },
  { key: "problemSolving", label: "Problem solving", weight: 25, description: "Reasoning, judgment, trade-offs, and adaptability" },
  { key: "communication", label: "Communication & behavioral", weight: 20, description: "Clarity, ownership, collaboration, and behavioral evidence" },
  { key: "culture", label: "Culture fit / system alignment", weight: 17, description: "North Star, compensation, culture, and risk alignment" },
];

export function weightedScore(
  scores: Record<ScoringDimensionKey, number>,
  dimensions = scoringDimensions,
) {
  const totalWeight = dimensions.reduce((total, dimension) => total + dimension.weight, 0);
  const weightedTotal = dimensions.reduce(
    (total, dimension) => total + scores[dimension.key] * dimension.weight,
    0,
  );
  return Math.round(weightedTotal / totalWeight);
}

export const candidates = [
  { id: "maya-chen", name: "Maya Chen", initials: "MC", role: "Senior Product Designer", score: 93, resume: 92, interview: 96, stage: "Final review", location: "Kuala Lumpur", experience: "7 years", skills: ["Product strategy", "Figma", "Design systems"], metrics: { reputation: 96, match: 92, northStar: 94, compensation: 88, culture: 90, redFlags: 95 }, rubric: { technical: 94, problemSolving: 96, communication: 92, culture: 90 }, matchedKeywords: ["design systems", "product strategy", "B2B SaaS", "user research", "cross-functional"] },
  { id: "daniel-kim", name: "Daniel Kim", initials: "DK", role: "Senior Product Designer", score: 88, resume: 91, interview: 87, stage: "Interview", location: "Singapore", experience: "6 years", skills: ["UX research", "Prototyping", "B2B SaaS"], metrics: { reputation: 87, match: 91, northStar: 86, compensation: 80, culture: 88, redFlags: 91 }, rubric: { technical: 90, problemSolving: 88, communication: 84, culture: 88 }, matchedKeywords: ["UX research", "prototyping", "B2B SaaS"] },
  { id: "priya-nair", name: "Priya Nair", initials: "PN", role: "AI Product Manager", score: 89, resume: 84, interview: 90, stage: "Assessment", location: "Remote", experience: "5 years", skills: ["AI products", "Analytics", "Roadmapping"], metrics: { reputation: 90, match: 84, northStar: 91, compensation: 85, culture: 88, redFlags: 86 }, rubric: { technical: 86, problemSolving: 92, communication: 90, culture: 88 }, matchedKeywords: ["AI products", "analytics", "roadmapping"] },
  { id: "marcus-lee", name: "Marcus Lee", initials: "ML", role: "Frontend Engineer", score: 82, resume: 86, interview: 78, stage: "New", location: "Penang", experience: "4 years", skills: ["React", "TypeScript", "Accessibility"], metrics: { reputation: 78, match: 86, northStar: 84, compensation: 82, culture: 80, redFlags: 83 }, rubric: { technical: 88, problemSolving: 82, communication: 74, culture: 80 }, matchedKeywords: ["React", "TypeScript", "accessibility"] },
  { id: "sara-wong", name: "Sara Wong", initials: "SW", role: "Frontend Engineer", score: 76, resume: 79, interview: 73, stage: "Screening", location: "Johor Bahru", experience: "3 years", skills: ["Next.js", "Testing", "CSS"], metrics: { reputation: 73, match: 79, northStar: 78, compensation: 75, culture: 77, redFlags: 74 }, rubric: { technical: 80, problemSolving: 76, communication: 70, culture: 77 }, matchedKeywords: ["Next.js", "testing", "CSS"] },
];

export const jobs = [
  { id: "senior-product-designer", title: "Senior Product Designer", team: "Product", candidates: 42, interviews: 8, status: "Active", age: "12 days", fit: 86, location: "Kuala Lumpur · Hybrid", employmentType: "Full-time", salary: "RM 12,000–16,000 / month", description: "Lead product design across discovery, systems, and delivery for our B2B AI platform.", keywords: ["design systems", "product strategy", "B2B SaaS", "user research", "cross-functional"] },
  { id: "frontend-engineer", title: "Frontend Engineer", team: "Engineering", candidates: 31, interviews: 5, status: "Active", age: "8 days", fit: 82, location: "Malaysia · Remote", employmentType: "Full-time", salary: "RM 10,000–14,000 / month", description: "Build accessible, reliable product experiences in React and Next.js.", keywords: ["React", "TypeScript", "Next.js", "accessibility", "testing"] },
  { id: "ai-product-manager", title: "AI Product Manager", team: "Product", candidates: 18, interviews: 3, status: "Active", age: "5 days", fit: 88, location: "Kuala Lumpur · Hybrid", employmentType: "Full-time", salary: "RM 13,000–18,000 / month", description: "Shape AI product strategy from customer problem discovery through measurable adoption.", keywords: ["AI products", "analytics", "roadmapping", "experimentation"] },
  { id: "people-operations-lead", title: "People Operations Lead", team: "People", candidates: 0, interviews: 0, status: "Draft", age: "Updated today", fit: 0, location: "Kuala Lumpur · Hybrid", employmentType: "Full-time", salary: "RM 9,000–12,000 / month", description: "Build scalable, transparent people operations for a growing regional team.", keywords: ["people operations", "workforce planning", "employee experience"] },
];
