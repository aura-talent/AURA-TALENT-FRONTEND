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
  {
    key: "reputation",
    label: "Reputational score",
    description: "Mock interview performance and evidence quality",
  },
  {
    key: "match",
    label: "Keyword match",
    description: "Resume evidence against prioritized role keywords",
  },
  {
    key: "northStar",
    label: "North Star alignment",
    description: "Career direction, motivation, and role outcomes",
  },
  {
    key: "compensation",
    label: "Compensation / allowance",
    description: "Salary expectations and total package alignment",
  },
  {
    key: "culture",
    label: "Cultural alignment",
    description: "Team behaviors and system alignment",
  },
  {
    key: "redFlags",
    label: "Red flag confidence",
    description: "Risk checks; a higher score means lower observed risk",
  },
];

export const defaultMetricPriorities: Record<EvaluationMetricKey, number> = {
  reputation: 9,
  match: 10,
  northStar: 9,
  compensation: 7,
  culture: 8,
  redFlags: 8,
};

export type ScoringDimensionKey =
  | "technical"
  | "problemSolving"
  | "communication"
  | "culture";

export const scoringDimensions: Array<{
  key: ScoringDimensionKey;
  label: string;
  weight: number;
  description: string;
}> = [
  {
    key: "technical",
    label: "Technical core",
    weight: 38,
    description: "Role knowledge, skills, and quality of technical evidence",
  },
  {
    key: "problemSolving",
    label: "Problem solving",
    weight: 25,
    description: "Reasoning, judgment, trade-offs, and adaptability",
  },
  {
    key: "communication",
    label: "Communication & behavioral",
    weight: 20,
    description: "Clarity, ownership, collaboration, and behavioral evidence",
  },
  {
    key: "culture",
    label: "Culture fit / system alignment",
    weight: 17,
    description: "North Star, compensation, culture, and risk alignment",
  },
];

export function weightedScore(
  scores: Record<ScoringDimensionKey, number>,
  dimensions = scoringDimensions,
) {
  const totalWeight = dimensions.reduce(
    (total, dimension) => total + dimension.weight,
    0,
  );
  const weightedTotal = dimensions.reduce(
    (total, dimension) => total + scores[dimension.key] * dimension.weight,
    0,
  );
  return Math.round(weightedTotal / totalWeight);
}

export const interviewEvaluationPriorities = [
  {
    key: "content",
    label: "Content",
    priority: 10,
    description: "Relevance, depth, examples, and role-specific knowledge",
  },
  {
    key: "clarity",
    label: "Clarity",
    priority: 8,
    description: "Structure, precision, and ease of understanding",
  },
  {
    key: "confidence",
    label: "Confidence",
    priority: 7,
    description: "Conviction, composure, and ownership of responses",
  },
  {
    key: "bodyLanguage",
    label: "Body language",
    priority: 5,
    description: "Eye contact, posture, expression, and visual presence",
  },
] as const;

export type InterviewEvaluationKey =
  (typeof interviewEvaluationPriorities)[number]["key"];

export type InterviewEvaluation = {
  completedAt: string;
  duration: string;
  mode: string;
  scores: Record<InterviewEvaluationKey, number>;
  summary: string;
  responses: Array<{
    question: string;
    response: string;
    score: number;
    evidence: string;
  }>;
};

export const interviewEvaluations: Record<string, InterviewEvaluation> = {
  "maya-chen": {
    completedAt: "Today, 10:39 AM",
    duration: "32 minutes",
    mode: "Video and voice",
    scores: { content: 98, clarity: 96, confidence: 95, bodyLanguage: 93 },
    summary:
      "Maya gave specific, measurable examples with strong product judgment and consistent ownership across discovery, alignment, and delivery.",
    responses: [
      {
        question:
          "Walk me through a product decision where user needs and business goals were in tension.",
        response:
          "I reframed the conflict around the decision we needed to make, then paired customer interviews with conversion data. We reduced the first release to the two workflows that solved the highest-cost user problem and set a measurable adoption threshold for the next phase.",
        score: 97,
        evidence: "Clear trade-off, measurable outcome, and direct ownership",
      },
      {
        question: "Tell me about a time research changed your direction.",
        response:
          "Research showed that our assumed power-user workflow was creating anxiety for new admins. I brought the recordings into a product review, changed the information architecture, and validated the revised flow before engineering committed to it.",
        score: 96,
        evidence: "Uses research as decision evidence and aligns the team",
      },
      {
        question:
          "Describe a project that did not land as expected. What did you learn?",
        response:
          "I launched a dashboard that tested well but had weak repeat usage. I had optimized for comprehension rather than the recurring decision users needed to make. We rebuilt the experience around alerts and actions, and I changed how I define success in discovery.",
        score: 94,
        evidence: "Specific reflection without deflection or vague claims",
      },
    ],
  },
  "daniel-kim": {
    completedAt: "Yesterday, 3:14 PM",
    duration: "28 minutes",
    mode: "Video and voice",
    scores: { content: 89, clarity: 88, confidence: 84, bodyLanguage: 83 },
    summary:
      "Daniel demonstrated strong research and prototyping fundamentals. Several answers would benefit from clearer outcome measurement and more explicit ownership.",
    responses: [
      {
        question:
          "Walk me through a product decision where user needs and business goals were in tension.",
        response:
          "We used prototype testing to identify which enterprise requirements were essential and which could move to a later release. I worked with product to sequence the experience and communicate the trade-off to stakeholders.",
        score: 88,
        evidence: "Good process; outcome evidence could be more specific",
      },
      {
        question:
          "How do you bring engineers and product managers into the design process?",
        response:
          "I use working sessions early, share rough artifacts, and ask engineering to identify constraints before the team commits to a direction. That usually gives us more options and avoids a late handoff.",
        score: 87,
        evidence: "Collaborative workflow with practical engineering inclusion",
      },
    ],
  },
  "priya-nair": {
    completedAt: "Monday, 11:08 AM",
    duration: "35 minutes",
    mode: "Voice and text",
    scores: { content: 92, clarity: 91, confidence: 90, bodyLanguage: 84 },
    summary:
      "Priya showed excellent AI product reasoning, structured experimentation, and clear stakeholder communication. Visual-presence evidence is limited because part of the interview was text-based.",
    responses: [
      {
        question:
          "How would you validate an AI capability before committing a full product team?",
        response:
          "I would define the user decision the capability improves, establish a manual baseline, and test whether the model creates enough quality or speed improvement to change behavior. Only then would I expand the technical investment.",
        score: 93,
        evidence: "Strong validation sequence and avoids technology-first framing",
      },
      {
        question:
          "Tell me about a roadmap decision where evidence changed your priorities.",
        response:
          "Usage analysis showed our most requested feature would not address the retention problem. I presented the cohort evidence, moved onboarding instrumentation ahead of the feature, and used the results to reset the next quarter's roadmap.",
        score: 91,
        evidence: "Evidence-led prioritization and stakeholder alignment",
      },
    ],
  },
};

export const stagePipeline = [
  "Application Received",
  "Under Review",
  "Shortlisted",
  "Interview Scheduled",
  "Assessment",
  "Offer Extended",
  "Hired",
] as const;

export const stageOptions = [...stagePipeline, "Rejected"] as const;

export type Stage = (typeof stageOptions)[number];

// One color per pipeline stage: a cool→warm→green progression that reads as
// "just arrived → advancing → won", with red reserved for Rejected. Consumed by
// the shared <StageChip> component (components/employer/StageChip.tsx).
export const stageColors: Record<Stage, string> = {
  "Application Received": "#475569",
  "Under Review": "#2563eb",
  "Shortlisted": "#4f46e5",
  "Interview Scheduled": "#7c3aed",
  "Assessment": "#d97706",
  "Offer Extended": "#0d9488",
  "Hired": "#16a34a",
  "Rejected": "#dc2626",
};

// Hiring Pipeline phases — the lifecycle a *job listing itself* moves
// through, from headcount planning to close. Each board card is a job
// listing (never a candidate); this is unrelated to `stagePipeline` above,
// which tracks one candidate's application progress within a job.
export const pipelinePhases = [
  { id: "planning", label: "Planning", color: "#64748b" },
  { id: "open-hiring", label: "Open / Active Hiring", color: "#2563eb" },
  { id: "evaluation", label: "Evaluation", color: "#7c3aed" },
  { id: "offer-decision", label: "Offer / Decision", color: "#0d9488" },
  { id: "filled", label: "Filled", color: "#16a34a" },
  { id: "closed", label: "Closed", color: "#dc2626" },
] as const;

export type PipelinePhaseId = (typeof pipelinePhases)[number]["id"];

export const candidates = [
  {
    id: "maya-chen",
    name: "Maya Chen",
    initials: "MC",
    role: "Senior Product Designer",
    score: 93,
    resume: 92,
    interview: 96,
    applied: true,
    interviewAttempted: true,
    jobId: "senior-product-designer",
    stage: "Shortlisted",
    location: "Kuala Lumpur",
    experience: "7 years",
    skills: ["Product strategy", "Figma", "Design systems"],
    metrics: {
      reputation: 96,
      match: 92,
      northStar: 94,
      compensation: 88,
      culture: 90,
      redFlags: 95,
    },
    rubric: {
      technical: 94,
      problemSolving: 96,
      communication: 92,
      culture: 90,
    },
    matchedKeywords: [
      "design systems",
      "product strategy",
      "B2B SaaS",
      "user research",
      "cross-functional",
    ],
  },
  {
    id: "daniel-kim",
    name: "Daniel Kim",
    initials: "DK",
    role: "Senior Product Designer",
    score: 88,
    resume: 91,
    interview: 87,
    applied: false,
    interviewAttempted: true,
    jobId: "senior-product-designer",
    stage: "Rejected",
    location: "Singapore",
    experience: "6 years",
    skills: ["UX research", "Prototyping", "B2B SaaS"],
    metrics: {
      reputation: 87,
      match: 91,
      northStar: 86,
      compensation: 80,
      culture: 88,
      redFlags: 91,
    },
    rubric: {
      technical: 90,
      problemSolving: 88,
      communication: 84,
      culture: 88,
    },
    matchedKeywords: ["UX research", "prototyping", "B2B SaaS"],
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    initials: "PN",
    role: "AI Product Manager",
    score: 89,
    resume: 84,
    interview: 90,
    applied: true,
    interviewAttempted: true,
    jobId: "ai-product-manager",
    stage: "Rejected",
    location: "Remote",
    experience: "5 years",
    skills: ["AI products", "Analytics", "Roadmapping"],
    metrics: {
      reputation: 90,
      match: 84,
      northStar: 91,
      compensation: 85,
      culture: 88,
      redFlags: 86,
    },
    rubric: {
      technical: 86,
      problemSolving: 92,
      communication: 90,
      culture: 88,
    },
    matchedKeywords: ["AI products", "analytics", "roadmapping"],
  },
  {
    id: "marcus-lee",
    name: "Marcus Lee",
    initials: "ML",
    role: "Frontend Engineer",
    score: 82,
    resume: 86,
    interview: null,
    applied: true,
    interviewAttempted: false,
    jobId: "frontend-engineer",
    stage: "Application Received",
    location: "Penang",
    experience: "4 years",
    skills: ["React", "TypeScript", "Accessibility"],
    metrics: {
      reputation: 0,
      match: 86,
      northStar: 84,
      compensation: 82,
      culture: 80,
      redFlags: 83,
    },
    rubric: {
      technical: 88,
      problemSolving: 82,
      communication: 74,
      culture: 80,
    },
    matchedKeywords: ["React", "TypeScript", "accessibility"],
  },
  {
    id: "sara-wong",
    name: "Sara Wong",
    initials: "SW",
    role: "Frontend Engineer",
    score: 76,
    resume: 79,
    interview: null,
    applied: false,
    interviewAttempted: false,
    jobId: "frontend-engineer",
    stage: "Under Review",
    location: "Johor Bahru",
    experience: "3 years",
    skills: ["Next.js", "Testing", "CSS"],
    metrics: {
      reputation: 0,
      match: 79,
      northStar: 78,
      compensation: 75,
      culture: 77,
      redFlags: 74,
    },
    rubric: {
      technical: 80,
      problemSolving: 76,
      communication: 70,
      culture: 77,
    },
    matchedKeywords: ["Next.js", "testing", "CSS"],
  },
  {
    id: "elena-cruz",
    name: "Elena Cruz",
    initials: "EC",
    role: "Principal Product Designer",
    score: 91,
    resume: 90,
    interview: null,
    applied: false,
    interviewAttempted: false,
    jobId: "senior-product-designer",
    stage: "Application Received",
    location: "Singapore",
    experience: "9 years",
    skills: ["Design systems", "0-to-1 product", "Team leadership"],
    metrics: {
      reputation: 0,
      match: 90,
      northStar: 88,
      compensation: 84,
      culture: 86,
      redFlags: 92,
    },
    rubric: {
      technical: 92,
      problemSolving: 90,
      communication: 86,
      culture: 86,
    },
    matchedKeywords: ["design systems", "product strategy", "B2B SaaS"],
  },
  {
    id: "ryan-tanaka",
    name: "Ryan Tanaka",
    initials: "RT",
    role: "Senior Frontend Engineer",
    score: 85,
    resume: 83,
    interview: null,
    applied: false,
    interviewAttempted: false,
    jobId: "frontend-engineer",
    stage: "Application Received",
    location: "Remote",
    experience: "6 years",
    skills: ["React", "Next.js", "Performance tuning"],
    metrics: {
      reputation: 0,
      match: 85,
      northStar: 80,
      compensation: 78,
      culture: 79,
      redFlags: 88,
    },
    rubric: {
      technical: 87,
      problemSolving: 83,
      communication: 78,
      culture: 79,
    },
    matchedKeywords: ["React", "Next.js", "accessibility"],
  },
];

export const jobs = [
  {
    id: "senior-product-designer",
    title: "Senior Product Designer",
    company: "Northstar Labs",
    team: "Product",
    candidates: 42,
    interviews: 8,
    status: "Active",
    age: "12 days",
    fit: 94,
    location: "Kuala Lumpur · Hybrid",
    employmentType: "Full-time",
    salary: "RM 12,000–16,000 / month",
    description:
      "Lead product design across discovery, systems, and delivery for our B2B AI platform.",
    keywords: [
      "design systems",
      "product strategy",
      "B2B SaaS",
      "user research",
      "cross-functional",
    ],
    mockInterviewEnabled: true,
    interviewQuestions: 6,
    recommended: true,
    headhunterIds: ["aura-executive-search"],
    pipelinePhase: "offer-decision",
  },
  {
    id: "frontend-engineer",
    title: "Frontend Engineer",
    company: "Northstar Labs",
    team: "Engineering",
    candidates: 31,
    interviews: 5,
    status: "Active",
    age: "8 days",
    fit: 89,
    location: "Malaysia · Remote",
    employmentType: "Full-time",
    salary: "RM 10,000–14,000 / month",
    description:
      "Build accessible, reliable product experiences in React and Next.js.",
    keywords: ["React", "TypeScript", "Next.js", "accessibility", "testing"],
    mockInterviewEnabled: true,
    interviewQuestions: 5,
    recommended: true,
    headhunterIds: ["aura-technical-sourcer"],
    pipelinePhase: "evaluation",
  },
  {
    id: "ai-product-manager",
    title: "AI Product Manager",
    company: "Northstar Labs",
    team: "Product",
    candidates: 18,
    interviews: 3,
    status: "Active",
    age: "5 days",
    fit: 86,
    location: "Kuala Lumpur · Hybrid",
    employmentType: "Full-time",
    salary: "RM 13,000–18,000 / month",
    description:
      "Shape AI product strategy from customer problem discovery through measurable adoption.",
    keywords: ["AI products", "analytics", "roadmapping", "experimentation"],
    mockInterviewEnabled: true,
    interviewQuestions: 7,
    recommended: false,
    headhunterIds: [],
    pipelinePhase: "open-hiring",
  },
  {
    id: "people-operations-lead",
    title: "People Operations Lead",
    company: "Northstar Labs",
    team: "People",
    candidates: 0,
    interviews: 0,
    status: "Draft",
    age: "Updated today",
    fit: 72,
    location: "Kuala Lumpur · Hybrid",
    employmentType: "Full-time",
    salary: "RM 9,000–12,000 / month",
    description:
      "Build scalable, transparent people operations for a growing regional team.",
    keywords: [
      "people operations",
      "workforce planning",
      "employee experience",
    ],
    mockInterviewEnabled: false,
    interviewQuestions: 0,
    recommended: false,
    headhunterIds: [],
    pipelinePhase: "planning",
  },
];

// Per-job workforce plan — every job listing owns its own headcount and
// budget plan, instead of one shared department-wide plan. This is the
// source of truth the "Planning" phase in `pipelinePhases` above points to.
export type PlanStatus = "Draft" | "Approved" | "Published";

export function planStatusChipClass(status: PlanStatus) {
  if (status === "Published") return "chip-tier-high";
  if (status === "Approved") return "chip-tier-caution";
  return "";
}

export type JobPlan = {
  status: PlanStatus;
  priority: "High" | "Medium" | "Low";
  backfill: boolean;
  openings: number;
  baselineHeadcount: number;
  budget: number;
  hiringManager: string;
  targetStartDate: string;
  targetFillDate: string;
  justification: string;
  demandSignal: {
    reason: string;
    risk: "High" | "Medium" | "Covered";
  };
  lastUpdated: string;
};

// Keyed by job id. A job created through "Create job" won't have an entry
// here until its plan is first saved — JobPlanEditor seeds sensible
// defaults for that case.
export const jobPlans: Record<string, JobPlan> = {
  "senior-product-designer": {
    status: "Published",
    priority: "High",
    backfill: false,
    openings: 1,
    baselineHeadcount: 8,
    budget: 192000,
    hiringManager: "Wei Ling Tan",
    targetStartDate: "Apr 2026",
    targetFillDate: "Jul 2026",
    justification:
      "Design org is short a senior IC to own the B2B platform's design system ahead of two Q3 launches.",
    demandSignal: {
      reason: "Two product launches planned in Q3 need dedicated systems ownership",
      risk: "High",
    },
    lastUpdated: "2 days ago",
  },
  "frontend-engineer": {
    status: "Published",
    priority: "High",
    backfill: true,
    openings: 2,
    baselineHeadcount: 14,
    budget: 264000,
    hiringManager: "Farid Hassan",
    targetStartDate: "May 2026",
    targetFillDate: "Aug 2026",
    justification:
      "Two additional frontend engineers needed to keep pace with the platform roadmap and cover attrition risk on the current team.",
    demandSignal: {
      reason: "Platform roadmap and attrition risk are raising frontend capacity needs",
      risk: "High",
    },
    lastUpdated: "5 days ago",
  },
  "ai-product-manager": {
    status: "Approved",
    priority: "Medium",
    backfill: false,
    openings: 1,
    baselineHeadcount: 5,
    budget: 216000,
    hiringManager: "Grace Lim",
    targetStartDate: "Jun 2026",
    targetFillDate: "Sep 2026",
    justification:
      "New PM needed to own the AI product roadmap as adoption scales beyond pilot customers.",
    demandSignal: {
      reason: "Two launches planned in Q3 need dedicated product ownership",
      risk: "Medium",
    },
    lastUpdated: "1 week ago",
  },
  "people-operations-lead": {
    status: "Draft",
    priority: "Medium",
    backfill: false,
    openings: 1,
    baselineHeadcount: 3,
    budget: 132000,
    hiringManager: "Aisha Rahman",
    targetStartDate: "TBD",
    targetFillDate: "TBD",
    justification:
      "Scaling regional team requires dedicated people operations leadership; pending budget approval.",
    demandSignal: {
      reason: "Existing capacity is sufficient through Q4, but a new region launch may change this",
      risk: "Covered",
    },
    lastUpdated: "Today",
  },
};

export const talentPoolProfiles: Record<
  string,
  {
    previousOutcome: string;
    reason: string;
    targetRoles: string[];
    preferredLocations: string[];
    availableFrom: string;
    lastContacted: string;
  }
> = {
  "daniel-kim": {
    previousOutcome: "Final interview · Senior Product Designer",
    reason: "Strong finalist; another candidate had deeper design-systems leadership.",
    targetRoles: ["Senior Product Designer", "Product Design Lead"],
    preferredLocations: ["Singapore", "Remote"],
    availableFrom: "Now",
    lastContacted: "4 months ago",
  },
  "priya-nair": {
    previousOutcome: "Assessment · AI Product Manager",
    reason: "High-potential candidate; role was paused before the final round.",
    targetRoles: ["AI Product Manager", "Product Lead"],
    preferredLocations: ["Remote", "Kuala Lumpur"],
    availableFrom: "July 2026",
    lastContacted: "2 months ago",
  },
};

export type HeadhunterStatus = "Draft" | "Active" | "Paused";

export function headhunterStatusChipClass(status: HeadhunterStatus) {
  if (status === "Active") return "chip-tier-high";
  if (status === "Paused") return "chip-tier-caution";
  return "";
}

export type Headhunter = {
  id: string;
  name: string;
  persona: string;
  status: HeadhunterStatus;
  focusAreas: string[];
  stats: {
    candidatesSourced: number;
    avgMatchScore: number;
    lastActiveAt: string;
  };
};

// Avatar marks are always derived from the name, never separately configured.
// Uses the last two words' initials (e.g. "Aura Technical Sourcer" -> "TS")
// so the shared "Aura ___" naming convention still differentiates agents.
export function headhunterInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const secondLast = parts[parts.length - 2];
  const last = parts[parts.length - 1];
  return (secondLast[0] + last[0]).toUpperCase();
}

export const headhunters: Headhunter[] = [
  {
    id: "aura-technical-sourcer",
    name: "Aura Technical Sourcer",
    persona: "Scouts engineering talent from GitHub activity and open-source contributions.",
    status: "Active",
    focusAreas: ["React", "TypeScript", "Frontend performance"],
    stats: { candidatesSourced: 6, avgMatchScore: 84, lastActiveAt: "5 hours ago" },
  },
  {
    id: "aura-executive-search",
    name: "Aura Executive Search",
    persona: "Finds senior design and product leaders open to a confidential move.",
    status: "Active",
    focusAreas: ["Product design leadership", "Design systems", "0-to-1"],
    stats: { candidatesSourced: 3, avgMatchScore: 90, lastActiveAt: "2 days ago" },
  },
  {
    id: "aura-growth-scout",
    name: "Aura Growth Scout",
    persona: "Sources AI product and growth talent from founder networks.",
    status: "Draft",
    focusAreas: ["AI products", "Growth", "Experimentation"],
    stats: { candidatesSourced: 0, avgMatchScore: 0, lastActiveAt: "Never" },
  },
];

export type HeadhunterSuggestion = {
  headhunterId: string;
  jobId: string;
  matchScore: number;
  summary: string;
  sourcedFrom: string;
  sourcedAt: string;
  keyStrengths: string[];
};

// Keyed by candidate id, mirroring talentPoolProfiles' shape. A candidate
// has at most one headhunter suggestion in this mock model.
export const headhunterSuggestions: Record<string, HeadhunterSuggestion> = {
  "elena-cruz": {
    headhunterId: "aura-executive-search",
    jobId: "senior-product-designer",
    matchScore: 91,
    summary:
      "Led design systems for two Series C SaaS products; open to a confidential move for the right scope.",
    sourcedFrom: "LinkedIn · Passive candidate",
    sourcedAt: "2 days ago",
    keyStrengths: ["Design systems", "0-to-1 product", "Team leadership"],
  },
  "ryan-tanaka": {
    headhunterId: "aura-technical-sourcer",
    jobId: "frontend-engineer",
    matchScore: 85,
    summary:
      "Maintains a popular React performance-tooling library; strong signal on production-grade frontend work.",
    sourcedFrom: "GitHub · Open-source contributions",
    sourcedAt: "5 hours ago",
    keyStrengths: ["React", "Next.js", "Performance tuning"],
  },
};
