import Link from "next/link";
import SectionHeader from "./SectionHeader";
import { headhunters, headhunterStatusChipClass } from "@/app/employer/data";
import styles from "./JobEditor.module.css";

export default function HeadhunterSection({
  headhunterIds,
  onToggle,
}: {
  headhunterIds: string[];
  onToggle: (headhunterId: string, enabled: boolean) => void;
}) {
  return (
    <section className={`panel employer-section ${styles.section}`}>
      <SectionHeader
        number="05"
        title="Headhunters"
        description="Assign AI sourcing agents to actively scout the talent pool for this role. Any number can work the same job."
      />

      {headhunters.length === 0 ? (
        <div className={`notice notice-info ${styles.notice}`}>
          <strong>No headhunters yet. </strong>
          Create one to start sourcing candidates for this job automatically.
        </div>
      ) : (
        <div className={styles.headhunterList}>
          {headhunters.map((headhunter) => {
            const checked = headhunterIds.includes(headhunter.id);
            return (
              <label key={headhunter.id} className={styles.headhunterRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) =>
                    onToggle(headhunter.id, event.target.checked)
                  }
                />
                <span className={styles.check}>✓</span>
                <div>
                  <div className={styles.headhunterRowHead}>
                    <strong>{headhunter.name}</strong>
                    <span className={`chip ${headhunterStatusChipClass(headhunter.status)}`}>
                      {headhunter.status}
                    </span>
                  </div>
                  <small>{headhunter.persona}</small>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <Link href="/employer/headhunters/new" className="btn btn-ghost mt-2">
        + Create new headhunter
      </Link>
    </section>
  );
}
