export type PlanSummary = {
  currentHeadcount: number;
  approvedOpenings: number;
  annualBudget: number;
};

export type DepartmentPlan = {
  id: number;
  department: string;
  roles: number;
  budget: number;
  staffed: number;
};

export type DemandSignal = {
  department: string;
  reason: string;
  risk: "High" | "Medium" | "Covered";
};
