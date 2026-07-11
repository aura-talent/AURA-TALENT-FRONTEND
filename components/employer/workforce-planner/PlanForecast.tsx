import type { JobPlan } from "@/app/employer/data";
import styles from "./WorkforcePlanner.module.css";

const months = ["M1", "M2", "M3", "M4", "M5", "M6"];

export default function PlanForecast({ plan }: { plan: JobPlan }) {
  const target = plan.baselineHeadcount + plan.openings;
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
            const projected = Math.round(
              plan.baselineHeadcount + plan.openings * progress,
            );

            return (
              <div className={styles.chartColumn} key={month}>
                <div className={styles.barGroup}>
                  <span
                    className={styles.actualBar}
                    style={{
                      height: `${Math.max((plan.baselineHeadcount / scaleMax) * 170, 8)}px`,
                    }}
                    title={`${plan.baselineHeadcount} baseline headcount`}
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
          <i className={styles.actualLegend} /> Baseline ({plan.baselineHeadcount})
        </span>
        <span>
          <i className={styles.plannedLegend} /> Target ({target})
        </span>
      </div>
    </section>
  );
}
