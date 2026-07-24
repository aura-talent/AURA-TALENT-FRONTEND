import styles from "./BountyEditor.module.css";
import type { BountyDetails } from "./types";

export default function DetailsSection({
  details,
  tagDraft,
  onDetailsChange,
  onTagDraftChange,
  onTagAdd,
  onTagRemove,
}: {
  details: BountyDetails;
  tagDraft: string;
  onDetailsChange: (patch: Partial<BountyDetails>) => void;
  onTagDraftChange: (value: string) => void;
  onTagAdd: () => void;
  onTagRemove: (tag: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Bounty details</h2>
      <p className={styles.sectionHint}>
        The title and brief candidates see on the public marketplace.
      </p>
      <div className="field">
        <label>Title</label>
        <input
          className="input"
          value={details.title}
          onChange={(event) => onDetailsChange({ title: event.target.value })}
          placeholder="e.g. Launch week bug bash"
        />
      </div>
      <div className="field">
        <label>Tags</label>
        <div className={styles.tagEditor}>
          <div className={styles.tagInput}>
            <input
              className="input"
              value={tagDraft}
              onChange={(event) => onTagDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onTagAdd();
                }
              }}
              placeholder="e.g. Marketing, QA, Design"
            />
            <button className="btn btn-ghost" onClick={onTagAdd}>
              Add
            </button>
          </div>
          <div className={styles.tags}>
            {details.tags.map((tag) => (
              <span className="chip" key={tag}>
                {tag}
                <button onClick={() => onTagRemove(tag)} aria-label={`Remove ${tag}`}>
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="field">
        <label>Brief and rules</label>
        <small>
          Supports Markdown — **bold**, *italic*, blank lines for new
          paragraphs, &quot;- &quot; for bullet lists, and links.
        </small>
        <textarea
          className="input"
          rows={10}
          value={details.rulesText}
          onChange={(event) => onDetailsChange({ rulesText: event.target.value })}
          placeholder={
            "What are candidates building, and what does a winning submission look like?\n\nYou can use **bold**, blank lines for paragraphs, and \"- \" for bullet lists."
          }
        />
      </div>
    </section>
  );
}
