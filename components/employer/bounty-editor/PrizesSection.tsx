import styles from "./BountyEditor.module.css";
import { formatPrize, type WinnerSlot } from "@/lib/bountyApi";

export default function PrizesSection({
  currency,
  winnerSlots,
  totalPool,
  onCurrencyChange,
  onAdd,
  onRemove,
  onAmountChange,
}: {
  currency: string;
  winnerSlots: WinnerSlot[];
  totalPool: number;
  onCurrencyChange: (value: string) => void;
  onAdd: () => void;
  onRemove: (rank: number) => void;
  onAmountChange: (rank: number, amount: number) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Prize pool</h2>
      <p className={styles.sectionHint}>
        Set a cash amount per rank. Total pool: {formatPrize(totalPool, currency)}
      </p>
      <div className="field">
        <label>Currency</label>
        <select
          className="input"
          value={currency}
          onChange={(event) => onCurrencyChange(event.target.value)}
        >
          <option>USD</option>
          <option>MYR</option>
          <option>SGD</option>
        </select>
      </div>
      <div className={styles.requirementList}>
        {winnerSlots.map((slot) => (
          <div className={styles.prizeRow} key={slot.rank}>
            <strong>Rank {slot.rank}</strong>
            <input
              className="input"
              type="number"
              min="0"
              step="10"
              value={slot.prize_amount}
              onChange={(event) => onAmountChange(slot.rank, Number(event.target.value))}
            />
            <button
              className={styles.removeRow}
              onClick={() => onRemove(slot.rank)}
              aria-label={`Remove rank ${slot.rank}`}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button className={styles.addRow} onClick={onAdd}>
        ＋ Add winner slot
      </button>
    </section>
  );
}
