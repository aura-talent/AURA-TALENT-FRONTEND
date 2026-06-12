import SectionHeader from "./SectionHeader";
import styles from "./JobEditor.module.css";

export default function KeywordsSection({
  keywords,
  draft,
  onDraftChange,
  onAdd,
  onRemove,
}: {
  keywords: string[];
  draft: string;
  onDraftChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (keyword: string) => void;
}) {
  return (
    <section className={`panel employer-section ${styles.section}`}>
      <SectionHeader
        number="03"
        title="Prioritized keywords"
        description="These terms receive extra attention during resume evidence extraction and matching."
      />

      <div className={styles.keywordEditor}>
        <div className={styles.keywordInput}>
          <input
            value={draft}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onAdd();
              }
            }}
            placeholder="Add a skill, tool, domain, or qualification"
          />
          <button onClick={onAdd}>Add</button>
        </div>

        <div className={styles.keywords}>
          {keywords.map((keyword) => (
            <span key={keyword}>
              {keyword}
              <button
                onClick={() => onRemove(keyword)}
                aria-label={`Remove ${keyword}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
