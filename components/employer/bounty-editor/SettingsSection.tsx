import type { SubmissionMode } from "@/lib/bountyApi";

export default function SettingsSection({
  submissionMode,
  deadline,
  onSubmissionModeChange,
  onDeadlineChange,
}: {
  submissionMode: SubmissionMode;
  deadline: string;
  onSubmissionModeChange: (value: SubmissionMode) => void;
  onDeadlineChange: (value: string) => void;
}) {
  return (
    <section className="panel employer-section">
      <h2>Settings</h2>
      <div className="form-grid">
        <div className="field">
          <label>Who can submit</label>
          <select
            className="input"
            value={submissionMode}
            onChange={(event) => onSubmissionModeChange(event.target.value as SubmissionMode)}
          >
            <option value="individual">Individuals only</option>
            <option value="team">Teams only</option>
            <option value="both">Individuals or teams</option>
          </select>
        </div>
        <div className="field">
          <label>Deadline (optional)</label>
          <input
            className="input"
            type="date"
            value={deadline}
            onChange={(event) => onDeadlineChange(event.target.value)}
          />
        </div>
      </div>
    </section>
  );
}
