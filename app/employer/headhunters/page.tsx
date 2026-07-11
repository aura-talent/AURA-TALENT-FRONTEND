import Link from "next/link";
import {
  headhunters,
  headhunterInitials,
  headhunterStatusChipClass,
  headhunterSuggestions,
  jobs,
} from "../data";

export default function HeadhuntersPage() {
  const activeCount = headhunters.filter((h) => h.status === "Active").length;
  const totalSourced = headhunters.reduce(
    (total, h) => total + h.stats.candidatesSourced,
    0,
  );
  const suggestionScores = Object.values(headhunterSuggestions).map(
    (s) => s.matchScore,
  );
  const avgMatch = suggestionScores.length
    ? Math.round(
        suggestionScores.reduce((total, score) => total + score, 0) /
          suggestionScores.length,
      )
    : 0;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">AI sourcing</p>
          <h1>Headhunters</h1>
          <p>
            Configure and deploy AI agents that scout the talent pool for you,
            the way a real recruiter would.
          </p>
        </div>
        <Link href="/employer/headhunters/new" className="btn btn-primary">
          + New headhunter
        </Link>
      </div>

      <div className="stat-card-row">
        <article className="panel">
          <p>Total headhunters</p>
          <strong>{headhunters.length}</strong>
          <span>On your roster</span>
        </article>
        <article className="panel">
          <p>Active</p>
          <strong>{activeCount}</strong>
          <span>Currently sourcing</span>
        </article>
        <article className="panel">
          <p>Candidates sourced</p>
          <strong>{totalSourced}</strong>
          <span>All time</span>
        </article>
        <article className="panel">
          <p>Avg. match score</p>
          <strong>{avgMatch || "—"}</strong>
          <span>Across sourced candidates</span>
        </article>
      </div>

      {headhunters.length === 0 ? (
        <div className="empty-state panel">
          <h3>No headhunters yet</h3>
          <p>Create your first AI sourcing agent to start scouting the talent pool.</p>
        </div>
      ) : (
        <div className="panel candidate-table-wrap">
          <table className="table employer-table">
            <thead>
              <tr>
                <th>Headhunter</th>
                <th>Status</th>
                <th>Focus areas</th>
                <th>Assigned jobs</th>
                <th>Sourced</th>
                <th>Avg. match</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {headhunters.map((headhunter) => {
                const assignedJobs = jobs.filter((job) =>
                  job.headhunterIds.includes(headhunter.id),
                );
                return (
                  <tr key={headhunter.id}>
                    <td>
                      <div className="candidate-cell">
                        <span className="candidate-avatar">
                          {headhunterInitials(headhunter.name)}
                        </span>
                        <div>
                          <strong>{headhunter.name}</strong>
                          <small>{headhunter.persona}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${headhunterStatusChipClass(headhunter.status)}`}>
                        {headhunter.status}
                      </span>
                    </td>
                    <td>{headhunter.focusAreas.join(", ")}</td>
                    <td>
                      {assignedJobs.length === 0
                        ? "—"
                        : assignedJobs.map((job) => job.title).join(", ")}
                    </td>
                    <td>
                      <span className="signal-score">
                        {headhunter.stats.candidatesSourced}
                      </span>
                    </td>
                    <td>
                      {headhunter.stats.avgMatchScore ? (
                        <span className="signal-score">
                          {headhunter.stats.avgMatchScore}%
                        </span>
                      ) : (
                        <span className="signal-missing">—</span>
                      )}
                    </td>
                    <td>{headhunter.stats.lastActiveAt}</td>
                    <td>
                      <Link
                        href={`/employer/headhunters/${headhunter.id}/edit`}
                        className="table-action"
                      >
                        Configure →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
