import type { JobPlanPayload } from "@/lib/employerApi";
import styles from "./WorkforcePlanner.module.css";

const months = ["M1", "M2", "M3", "M4", "M5", "M6"];

export default function PlanForecast({ plan }: { plan: JobPlanPayload }) {
  const baseline = plan.baseline_headcount ?? 0;
  const target = baseline + plan.openings;
  const scaleMax = Math.max(target, 1);

  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Headcount ramp</h2>
          <p>Baseline team size growing to target headcount</p>
        </div>
        <span className={styles.liveBadge}>Live preview</span>
      </div>

      <div className={styles.forecastChart}>
        <div className={styles.chartArea}>
          {months.map((month, index) => {
            const progress = (index + 1) / months.length;
            const projected = Math.round(baseline + plan.openings * progress);

            return (
              <div className={styles.chartColumn} key={month}>
                <div className={styles.barGroup}>
                  <span
                    className={styles.actualBar}
                    style={{
                      height: `${Math.max((baseline / scaleMax) * 170, 8)}px`,
                    }}
                    title={`${baseline} baseline headcount`}
                  />
                  <span
                    className={styles.plannedBar}
                    style={{
                      height: `${Math.max((projected / scaleMax) * 170, 8)}px`,
                    }}
                    title={`${projected} projected headcount`}
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
          <i className={styles.actualLegend} /> Baseline ({baseline})
        </span>
        <span>
          <i className={styles.plannedLegend} /> Target ({target})
        </span>
      </div>
    </section>
  );
}
