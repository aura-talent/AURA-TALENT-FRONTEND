import type { DepartmentPlan, PlanSummary } from "./types";
import styles from "./WorkforcePlanner.module.css";

const months = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ForecastPanel({
  summary,
  departments,
}: {
  summary: PlanSummary;
  departments: DepartmentPlan[];
}) {
  const plannedHires = departments.reduce(
    (total, department) => total + department.roles,
    0,
  );
  const scaleMax = Math.max(summary.currentHeadcount + plannedHires, 1);

  return (
    <section className={`panel employer-section ${styles.forecastPanel}`}>
      <div className="employer-section-head">
        <div>
          <h2>Headcount forecast</h2>
          <p>Live projection from the assumptions in this plan</p>
        </div>
        <span className={styles.liveBadge}>Live preview</span>
      </div>

      <div className={styles.forecastChart}>
        <div className={styles.chartArea}>
          {months.map((month, index) => {
            const progress = (index + 1) / months.length;
            const current = summary.currentHeadcount;
            const planned = current + Math.round(plannedHires * progress);

            return (
              <div className={styles.chartColumn} key={month}>
                <div className={styles.barGroup}>
                  <span
                    className={styles.actualBar}
                    style={{ height: `${Math.max((current / scaleMax) * 170, 8)}px` }}
                    title={`${current} current employees`}
                  />
                  <span
                    className={styles.plannedBar}
                    style={{ height: `${Math.max((planned / scaleMax) * 170, 8)}px` }}
                    title={`${planned} planned employees`}
                  />
                </div>
                <small>{month}</small>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.chartLegend}>
        <span>
          <i className={styles.actualLegend} /> Current headcount
        </span>
        <span>
          <i className={styles.plannedLegend} /> Planned headcount
        </span>
      </div>
    </section>
  );
}
