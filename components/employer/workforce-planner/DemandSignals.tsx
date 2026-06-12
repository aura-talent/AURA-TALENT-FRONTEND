import { Sparkles } from "lucide-react";
import type { DemandSignal } from "./types";
import styles from "./WorkforcePlanner.module.css";

const riskClass = {
  High: styles.riskHigh,
  Medium: styles.riskMedium,
  Covered: styles.riskLow,
};

export default function DemandSignals({ signals }: { signals: DemandSignal[] }) {
  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Demand signals</h2>
          <p>Predicted hiring pressure by team</p>
        </div>
        <span className={styles.auraBadge}>
          <Sparkles size={12} /> Predicted by Aura
        </span>
      </div>

      <div className={styles.demandList}>
        {signals.map((signal) => (
          <div key={signal.department}>
            <span>
              <strong>{signal.department}</strong>
              <small>{signal.reason}</small>
            </span>
            <b className={riskClass[signal.risk]}>{signal.risk}</b>
          </div>
        ))}
      </div>

      <p className={styles.predictionNote}>
        Aura predictions use the current plan, hiring velocity, and workforce
        risk signals. Review them before saving.
      </p>
    </section>
  );
}
