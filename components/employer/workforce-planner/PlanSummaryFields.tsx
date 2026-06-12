import type { PlanSummary } from "./types";
import styles from "./WorkforcePlanner.module.css";

export default function PlanSummaryFields({
  summary,
  onChange,
}: {
  summary: PlanSummary;
  onChange: (field: keyof PlanSummary, value: number) => void;
}) {
  return (
    <section className={styles.summaryGrid} aria-label="Workforce assumptions">
      <label className={`panel ${styles.summaryCard}`}>
        <span>Current headcount</span>
        <input
          type="number"
          min="0"
          value={summary.currentHeadcount}
          onChange={(event) =>
            onChange("currentHeadcount", Number(event.target.value))
          }
        />
        <small>Active employees today</small>
      </label>

      <label className={`panel ${styles.summaryCard}`}>
        <span>Approved openings</span>
        <input
          type="number"
          min="0"
          value={summary.approvedOpenings}
          onChange={(event) =>
            onChange("approvedOpenings", Number(event.target.value))
          }
        />
        <small>Roles approved for hiring</small>
      </label>

      <label className={`panel ${styles.summaryCard}`}>
        <span>Annual hiring budget</span>
        <div className={styles.currencyInput}>
          <b>RM</b>
          <input
            type="number"
            min="0"
            step="1000"
            value={summary.annualBudget}
            onChange={(event) =>
              onChange("annualBudget", Number(event.target.value))
            }
          />
        </div>
        <small>Recruitment and compensation allocation</small>
      </label>
    </section>
  );
}
