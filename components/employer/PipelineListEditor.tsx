"use client";

import styles from "./PipelineListEditor.module.css";

export type EditableItem = { label: string; color: string };

export default function PipelineListEditor<T extends EditableItem>({
  items,
  onChange,
  createItem,
  addLabel = "Add",
  pinned,
  onPinnedChange,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  addLabel?: string;
  pinned?: EditableItem;
  onPinnedChange?: (pinned: EditableItem) => void;
}) {
  function update(index: number, patch: Partial<T>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className={styles.editor}>
      <ol className={styles.rows}>
        {items.map((item, index) => (
          <li className={styles.row} key={index}>
            <div className={styles.reorder}>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${item.label} up`}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move ${item.label} down`}
              >
                ↓
              </button>
            </div>
            <input
              type="color"
              className={styles.swatch}
              value={item.color}
              onChange={(event) => update(index, { color: event.target.value } as Partial<T>)}
              aria-label={`${item.label || "Stage"} color`}
            />
            <input
              type="text"
              className="input"
              value={item.label}
              onChange={(event) => update(index, { label: event.target.value } as Partial<T>)}
              placeholder="Label"
            />
            <button
              type="button"
              className={styles.remove}
              onClick={() => remove(index)}
              aria-label={`Remove ${item.label}`}
            >
              ✕
            </button>
          </li>
        ))}
      </ol>

      {items.length === 0 && <p className={styles.empty}>No entries yet — add one below.</p>}

      {pinned && onPinnedChange && (
        <div className={styles.pinnedRow}>
          <span className={styles.pinnedLabel}>Terminal</span>
          <input
            type="color"
            className={styles.swatch}
            value={pinned.color}
            onChange={(event) => onPinnedChange({ ...pinned, color: event.target.value })}
            aria-label={`${pinned.label} color`}
          />
          <input
            type="text"
            className="input"
            value={pinned.label}
            onChange={(event) => onPinnedChange({ ...pinned, label: event.target.value })}
          />
        </div>
      )}

      <button type="button" className="btn btn-ghost" onClick={() => onChange([...items, createItem()])}>
        + {addLabel}
      </button>
    </div>
  );
}
