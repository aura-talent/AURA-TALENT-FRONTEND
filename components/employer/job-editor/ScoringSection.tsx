import {
  evaluationMetrics,
  scoringDimensions,
  type EvaluationMetricKey,
  type ScoringDimensionKey,
} from "@/app/employer/data";
import SectionHeader from "./SectionHeader";
import type {
  CustomCriterion,
  DimensionWeights,
  MetricPriorities,
} from "./types";
import styles from "./JobEditor.module.css";

export default function ScoringSection({
  priorities,
  customCriteria,
  dimensionWeights,
  totalPriority,
  totalDimensionWeight,
  minimumOfferScore,
  onPriorityChange,
  onCriterionNameChange,
  onCriterionPriorityChange,
  onCriterionRemove,
  onCriterionAdd,
  onDimensionWeightChange,
  onMinimumOfferScoreChange,
}: {
  priorities: MetricPriorities;
  customCriteria: CustomCriterion[];
  dimensionWeights: DimensionWeights;
  totalPriority: number;
  totalDimensionWeight: number;
  minimumOfferScore: number | null;
  onPriorityChange: (key: EvaluationMetricKey, value: number) => void;
  onCriterionNameChange: (id: number, name: string) => void;
  onCriterionPriorityChange: (id: number, priority: number) => void;
  onCriterionRemove: (id: number) => void;
  onCriterionAdd: () => void;
  onDimensionWeightChange: (key: ScoringDimensionKey, value: number) => void;
  onMinimumOfferScoreChange: (value: number | null) => void;
}) {
  return (
    <section className={`panel employer-section ${styles.section}`}>
      <SectionHeader
        number="04"
        title="Scoring system"
        description="Prioritize the evidence Aura evaluates, then configure how the four awarded dimension scores build the final result."
      />

      <div className={styles.scoringFlow}>
        <span>6 evaluation metrics</span>
        <b>→</b>
        <span>Evidence evaluated</span>
        <b>→</b>
        <span>4 dimension scores</span>
        <b>→</b>
        <span>Final score</span>
      </div>

      <div className={styles.scoringSubhead}>
        <div>
          <h3>Evaluation metric priorities</h3>
          <p>
            Priority controls how deeply each metric is considered while
            awarding the four dimension scores. It is not a separate score.
          </p>
        </div>
        <b>{totalPriority} priority points</b>
      </div>

      <div className={styles.metricList}>
        {evaluationMetrics.map((metric) => (
          <div className={styles.metricRow} key={metric.key}>
            <div>
              <strong>{metric.label}</strong>
              <p>{metric.description}</p>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={priorities[metric.key]}
              onChange={(event) =>
                onPriorityChange(metric.key, Number(event.target.value))
              }
              aria-label={`${metric.label} priority`}
            />
            <span className={styles.priorityValue}>
              {priorities[metric.key]}
              <small>/ 10</small>
            </span>
            <span className={styles.evidenceLabel}>Evidence</span>
          </div>
        ))}

        {customCriteria.map((criterion) => (
          <div className={styles.metricRow} key={criterion.id}>
            <div>
              <input
                className={styles.criterionName}
                value={criterion.name}
                onChange={(event) =>
                  onCriterionNameChange(criterion.id, event.target.value)
                }
                aria-label="Custom criterion name"
              />
              <p>Custom role-specific evaluation add-on</p>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              value={criterion.priority}
              onChange={(event) =>
                onCriterionPriorityChange(
                  criterion.id,
                  Number(event.target.value),
                )
              }
            />
            <span className={styles.priorityValue}>
              {criterion.priority}
              <small>/ 10</small>
            </span>
            <button
              className={styles.removeCriterion}
              onClick={() => onCriterionRemove(criterion.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button className={styles.addCriterion} onClick={onCriterionAdd}>
        ＋ Add custom criterion
      </button>

      <div className={styles.divider} />

      <div className={styles.scoringSubhead}>
        <div>
          <h3>Final score weights</h3>
          <p>
            Metric findings are awarded into these dimensions. Their weighted
            combination is the candidate&apos;s only final score.
          </p>
        </div>
        <b
          className={
            totalDimensionWeight === 100
              ? styles.validWeight
              : styles.invalidWeight
          }
        >
          {totalDimensionWeight}% total
        </b>
      </div>

      <div className={styles.dimensionWeights}>
        {scoringDimensions.map((dimension) => (
          <div key={dimension.key}>
            <div>
              <strong>{dimension.label}</strong>
              <p>{dimension.description}</p>
            </div>
            <input
              type="range"
              min={dimension.key === "technical" ? 35 : 10}
              max={dimension.key === "technical" ? 40 : 35}
              value={dimensionWeights[dimension.key]}
              onChange={(event) =>
                onDimensionWeightChange(
                  dimension.key,
                  Number(event.target.value),
                )
              }
              aria-label={`${dimension.label} weight`}
            />
            <span>{dimensionWeights[dimension.key]}%</span>
          </div>
        ))}
      </div>

      <div className={styles.formula}>
        <span>Weighted Linear Combination</span>
        <code>
          Final = Technical × {dimensionWeights.technical}% + Problem solving ×{" "}
          {dimensionWeights.problemSolving}% + Communication ×{" "}
          {dimensionWeights.communication}% + Culture/system ×{" "}
          {dimensionWeights.culture}%
        </code>
        <b>{totalDimensionWeight === 100 ? "Ready" : "Must total 100%"}</b>
      </div>

      <div className={styles.divider} />

      <div className={styles.scoringSubhead}>
        <div>
          <h3>Minimum offer score</h3>
          <p>
            An evaluated applicant below this final score is automatically rejected once
            Aura runs the Evaluation phase for this role (fully-automated jobs only) — everyone
            at or above it is a candidate for offer selection. Manual jobs use this only as a
            reference; nothing is auto-rejected.
          </p>
        </div>
      </div>
      <div className={styles.metricRow}>
        <div>
          <strong>Minimum final score</strong>
          <p>Leave blank to use the system default (60).</p>
        </div>
        <input
          className="input"
          type="number"
          min={0}
          max={100}
          placeholder="60"
          value={minimumOfferScore ?? ""}
          onChange={(event) => {
            const raw = event.target.value;
            onMinimumOfferScoreChange(raw === "" ? null : Number(raw));
          }}
          aria-label="Minimum offer score"
          style={{ maxWidth: "120px" }}
        />
      </div>
    </section>
  );
}
