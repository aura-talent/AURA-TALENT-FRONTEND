import styles from "./JobEditor.module.css";

export default function ScoringPreview({
  signalCount,
}: {
  signalCount: number;
}) {
  return (
    <section className={`panel employer-section ${styles.scoringPreview}`}>
      <p className="eyebrow">Scoring preview</p>
      <h2>One final score</h2>
      <div className={styles.priorityDonut}>
        <strong>{signalCount}</strong>
        <span>signals</span>
      </div>
      <p>
        {signalCount} evidence signals feed four awarded dimensions, which
        produce one explainable WLC result.
      </p>
    </section>
  );
}
