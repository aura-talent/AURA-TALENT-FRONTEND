"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Sparkles } from "lucide-react";
import AuraPlanModal from "./AuraPlanModal";
import DemandSignals from "./DemandSignals";
import DepartmentPlanEditor from "./DepartmentPlanEditor";
import ForecastPanel from "./ForecastPanel";
import PlanSummaryFields from "./PlanSummaryFields";
import type { DemandSignal, DepartmentPlan, PlanSummary } from "./types";
import styles from "./WorkforcePlanner.module.css";

const initialDepartments: DepartmentPlan[] = [
  {
    id: 1,
    department: "Engineering",
    roles: 6,
    budget: 1180000,
    staffed: 62,
  },
  {
    id: 2,
    department: "Product & Design",
    roles: 3,
    budget: 648000,
    staffed: 78,
  },
  {
    id: 3,
    department: "Go to market",
    roles: 2,
    budget: 412000,
    staffed: 90,
  },
];

const demandSignals: DemandSignal[] = [
  {
    department: "Engineering",
    reason: "Platform roadmap and attrition risk",
    risk: "High",
  },
  {
    department: "Product",
    reason: "Two launches planned in Q3",
    risk: "Medium",
  },
  {
    department: "Customer success",
    reason: "Capacity currently tracks the sales plan",
    risk: "Covered",
  },
  {
    department: "People",
    reason: "Existing capacity is sufficient through Q4",
    risk: "Covered",
  },
];

export default function WorkforcePlanner() {
  const importInput = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<PlanSummary>({
    currentHeadcount: 142,
    approvedOpenings: 11,
    annualBudget: 2400000,
  });
  const [departments, setDepartments] =
    useState<DepartmentPlan[]>(initialDepartments);
  const [showAuraModal, setShowAuraModal] = useState(false);
  const [importedFile, setImportedFile] = useState("");

  function updateDepartment(id: number, update: Partial<DepartmentPlan>) {
    setDepartments((current) =>
      current.map((department) =>
        department.id === id ? { ...department, ...update } : department,
      ),
    );
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Planning intelligence</p>
          <h1>Workforce plan</h1>
          <p>
            Set headcount, budget, and hiring demand in one working plan. Aura
            updates the forecast as your assumptions change, and every edit is
            reflected in the plan automatically.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => setShowAuraModal(true)}
          >
            <Sparkles size={15} /> Generate with Aura
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => importInput.current?.click()}
          >
            <FileSpreadsheet size={15} /> Import from Excel
          </button>
          <input
            ref={importInput}
            className={styles.hiddenInput}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => {
              setImportedFile(event.target.files?.[0]?.name ?? "");
            }}
          />
        </div>
      </div>

      {importedFile && (
        <div className={styles.importNotice} role="status">
          <FileSpreadsheet size={15} />
          <span>
            <strong>{importedFile}</strong> is ready to import. Parsed values
            will appear here once Excel ingestion is connected.
          </span>
          <button type="button" onClick={() => setImportedFile("")}>
            Dismiss
          </button>
        </div>
      )}

      <PlanSummaryFields
        summary={summary}
        onChange={(field, value) => {
          setSummary((current) => ({ ...current, [field]: value }));
        }}
      />

      <div className={styles.intelligenceGrid}>
        <ForecastPanel summary={summary} departments={departments} />
        <DemandSignals signals={demandSignals} />
      </div>

      <DepartmentPlanEditor
        departments={departments}
        onChange={updateDepartment}
        onAdd={() => {
          setDepartments((current) => [
            ...current,
            {
              id: Date.now(),
              department: "New department",
              roles: 1,
              budget: 0,
              staffed: 0,
            },
          ]);
        }}
        onRemove={(id) => {
          setDepartments((current) =>
            current.filter((department) => department.id !== id),
          );
        }}
      />

      {showAuraModal && (
        <AuraPlanModal onClose={() => setShowAuraModal(false)} />
      )}
    </div>
  );
}
