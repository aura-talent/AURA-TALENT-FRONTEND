export type TourStep = {
  selector: string;
  title: string;
  body: string;
};

export type TourPage = {
  path: string;
  steps: TourStep[];
};

export const TOUR_PAGES: TourPage[] = [
  {
    path: "/dashboard",
    steps: [
      {
        selector: "[data-tour='dashboard-stats']",
        title: "Your numbers at a glance",
        body: "Track how many roles you've applied to, your response rate, and upcoming interviews — all in one place.",
      },
      {
        selector: "[data-tour='dashboard-jobs-panel']",
        title: "Jobs suited for you",
        body: "Once your résumé is on file, Aura scans company portals and surfaces roles that actually match your profile.",
      },
      {
        selector: "[data-tour='dashboard-bounties-panel']",
        title: "Paid bounties",
        body: "Companies post real paid tasks here. Win cash, or build a public track record even if you don't.",
      },
    ],
  },
  {
    path: "/tracker",
    steps: [
      {
        selector: "[data-tour='tracker-quick-actions']",
        title: "Everything job hunting, one hub",
        body: "Find jobs, scan portals, evaluate a posting, or compare your evaluated offers side by side — all from here.",
      },
      {
        selector: "[data-tour='tracker-toolbar']",
        title: "Search and filter your pipeline",
        body: "Find any application by company, role, priority, or tag.",
      },
      {
        selector: "[data-tour='tracker-board']",
        title: "Your hiring pipeline",
        body: "Drag applications between stages as they progress. Click any card for the full timeline and notes.",
      },
    ],
  },
  {
    path: "/worth",
    steps: [
      {
        selector: "[data-tour='worth-form']",
        title: "Know your market rate",
        body: "Aura prices your resume against the live market and your university's real graduate outcomes, so you know what you're worth before you negotiate.",
      },
    ],
  },
  {
    path: "/bounties",
    steps: [
      {
        selector: "[data-tour='bounties-tabs']",
        title: "Browse or track your entries",
        body: "Switch between open bounties and the ones you've already submitted to.",
      },
      {
        selector: "[data-tour='bounties-list']",
        title: "Real paid work",
        body: "Each listing shows the prize pool and how many winners get paid. Click one to see the brief and submit.",
      },
    ],
  },
  {
    path: "/mock-interview",
    steps: [
      {
        selector: "[data-tour='mock-interview-input']",
        title: "Practice before it counts",
        body: "Enter the role you're targeting and Aura runs a live mock interview, reading what you say, how you say it, and your on-camera presence.",
      },
    ],
  },
  {
    path: "/jobs",
    steps: [
      {
        selector: "[data-tour='jobs-search']",
        title: "Search and filter",
        body: "Narrow down roles by keyword, or toggle to only see the ones Aura recommends for you.",
      },
      {
        selector: "[data-tour='jobs-grid']",
        title: "Every role, ranked",
        body: "Each card shows your match score. Click into a role for the full breakdown, or Quick Apply straight from here.",
      },
    ],
  },
  {
    path: "/evaluate",
    steps: [
      {
        selector: "[data-tour='evaluate-input']",
        title: "Paste a job link or description",
        body: "Aura reads the posting the way a sharp recruiter would.",
      },
      {
        selector: "[data-tour='evaluate-submit']",
        title: "Score your fit",
        body: "This scores the role against your real résumé and tells you honestly whether it's worth your time.",
      },
    ],
  },
];
