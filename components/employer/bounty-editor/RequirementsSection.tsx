import styles from "./BountyEditor.module.css";
import type { RequirementItem, RequirementType } from "@/lib/bountyApi";

export default function RequirementsSection({
  requirements,
  onAdd,
  onChange,
  onRemove,
}: {
  requirements: RequirementItem[];
  onAdd: () => void;
  onChange: (id: string, patch: Partial<RequirementItem>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Submission requirements</h2>
      <p className={styles.sectionHint}>
        Each item becomes its own field on the candidate submission form.
      </p>
      <div className={styles.requirementList}>
        {requirements.map((item) => (
          <div className={styles.requirementRow} key={item.id}>
            <input
              className="input"
              value={item.label}
              onChange={(event) => onChange(item.id, { label: event.target.value })}
              placeholder="Requirement label"
            />
            <input
              className="input"
              value={item.description}
              onChange={(event) => onChange(item.id, { description: event.target.value })}
              placeholder="Instructions (optional)"
            />
            <select
              className="input"
              value={item.type}
              onChange={(event) =>
                onChange(item.id, { type: event.target.value as RequirementType })
              }
            >
              <option value="file">File</option>
              <option value="link">Link</option>
              <option value="text">Text</option>
            </select>
            <label className={styles.requiredToggle}>
              <input
                type="checkbox"
                checked={item.required}
                onChange={(event) => onChange(item.id, { required: event.target.checked })}
              />
              Required
            </label>
            <button
              className={styles.removeRow}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.label}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {requirements.length === 0 && <p className={styles.sectionHint}>No requirements yet.</p>}
      <button className={styles.addRow} onClick={onAdd}>
        ＋ Add requirement
      </button>
    </section>
  );
}
