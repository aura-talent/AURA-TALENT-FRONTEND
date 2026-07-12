/**
 * Candidate-facing "explore jobs" mock data.
 *
 * This is the candidate side of the app, which is out of the current
 * employer-backend scope. These pages previously borrowed the employer
 * module's mock `jobs` array; that array has since been removed as the
 * employer side moved to real Supabase data. This local mock keeps the
 * candidate job-browsing pages working unchanged until the candidate side
 * gets its own real jobs feed.
 */

export type CandidateJob = {
  id: string;
  title: string;
  company: string;
  team: string;
  status: "Active" | "Draft";
  age: string;
  fit: number;
  location: string;
  employmentType: string;
  salary: string;
  description: string;
  keywords: string[];
  mockInterviewEnabled: boolean;
  interviewQuestions: number;
  recommended: boolean;
};

export const jobs: CandidateJob[] = [
  {
    id: "senior-product-designer",
    title: "Senior Product Designer",
    company: "Northstar Labs",
    team: "Product",
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
  },
  {
    id: "frontend-engineer",
    title: "Frontend Engineer",
    company: "Northstar Labs",
    team: "Engineering",
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
  },
  {
    id: "ai-product-manager",
    title: "AI Product Manager",
    company: "Northstar Labs",
    team: "Product",
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
  },
];
