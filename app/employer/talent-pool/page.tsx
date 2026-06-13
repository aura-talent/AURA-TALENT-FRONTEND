import Link from "next/link";
import {
  talentPoolCandidates,
  talentPoolProfiles,
} from "../data";

export default function TalentPoolPage() {
  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent re-engagement</p>
          <h1>Talent pool</h1>
          <p>
            Keep strong former candidates warm and reconnect when a better-fit
            role becomes available.
          </p>
        </div>
        <span className="chip chip-tier-high">
          {talentPoolCandidates.length} consented profiles
        </span>
      </div>

      <section className="talent-pool-intro panel">
        <span className="attention-icon">✦</span>
        <div>
          <strong>Aura watches new roles for renewed fit</strong>
          <p>
            This pool contains rejected candidates who scored at least 80 and
            agreed to hear about future opportunities.
          </p>
        </div>
      </section>

      <div className="panel candidate-table-wrap">
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Previous outcome</th>
              <th>Score</th>
              <th>Future interests</th>
              <th>Last contacted</th>
              <th>Consent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {talentPoolCandidates.map((candidate) => {
              const profile = talentPoolProfiles[candidate.id];
              return (
                <tr key={candidate.id}>
                  <td>
                    <div className="candidate-cell">
                      <span className="candidate-avatar">{candidate.initials}</span>
                      <div>
                        <strong>{candidate.name}</strong>
                        <small>{candidate.location} · {candidate.experience}</small>
                      </div>
                    </div>
                  </td>
                  <td className="talent-pool-outcome">
                    <strong>{profile.previousOutcome}</strong>
                    <small>{profile.reason}</small>
                  </td>
                  <td><span className="quality-score">{candidate.score}%</span></td>
                  <td>
                    <div className="talent-pool-tags">
                      {profile.targetRoles.map((role) => <span key={role}>{role}</span>)}
                    </div>
                  </td>
                  <td>{profile.lastContacted}</td>
                  <td><span className="completion-check">{profile.consent}</span></td>
                  <td>
                    <Link className="table-action" href={`/employer/candidates/${candidate.id}`}>
                      Evaluation →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
