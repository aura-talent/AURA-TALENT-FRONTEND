import Link from "next/link";
import { headhunterInitials } from "@/app/employer/data";
import {
  candidateInitials,
  timeAgo,
  type CandidateEvaluation,
  type EmployerHeadhunter,
  type TalentPoolEntry,
} from "@/lib/employerApi";

function bestEvaluation(entry: TalentPoolEntry): CandidateEvaluation | null {
  const evaluations = entry.evaluations ?? (entry.evaluation ? [entry.evaluation] : []);
  if (!evaluations.length) return null;
  return [...evaluations].sort(
    (a, b) => (b.wlc_score ?? -1) - (a.wlc_score ?? -1),
  )[0];
}

export default function CandidateOverviewModal({
  entry,
  headhunters,
  onClose,
}: {
  entry: TalentPoolEntry;
  headhunters: EmployerHeadhunter[];
  onClose: () => void;
}) {
  const name = entry.full_name ?? entry.email ?? "Candidate";
  const evaluation = bestEvaluation(entry);
  const headhunter =
    evaluation?.source === "headhunter" && evaluation.headhunter_id
      ? headhunters.find((item) => item.id === evaluation.headhunter_id)
      : undefined;
  const hasHeadhunterEvidence = Boolean(evaluation && headhunter);

  return (
    <div className="candidate-email-backdrop" onClick={onClose}>
      <section
        className="candidate-email-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="candidate-overview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <p className="eyebrow" style={{ marginBottom: "0.5rem" }}>
              Candidate overview
            </p>
            <h2 id="candidate-overview-title">{name}</h2>
          </div>
          <button
            className="candidate-email-close"
            onClick={onClose}
            aria-label="Close overview"
          >
            ×
          </button>
        </header>

        <div className="candidate-email-fields">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="candidate-avatar candidate-avatar-large">
              {candidateInitials(entry.full_name)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-72)" }}>
                {entry.email ?? "—"}
                {evaluation?.job_title ? ` · ${evaluation.job_title}` : ""}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                {evaluation?.interview_evaluation ? (
                  <span className="chip chip-tier-high">✓ Interview</span>
                ) : (
                  <span className="signal-missing">No interview</span>
                )}
                {entry.resume && <span className="chip">Resume on file</span>}
              </div>
            </div>
            <span className="candidate-score" style={{ flexShrink: 0 }}>
              <b style={{ fontSize: "1.9rem" }}>
                {evaluation?.wlc_score != null
                  ? `${Math.round(evaluation.wlc_score)}%`
                  : "—"}
              </b>
              <small>match</small>
            </span>
          </div>

          {evaluation && evaluation.matched_keywords.length > 0 && (
            <div>
              <span style={{ display: "block", color: "var(--ink-72)", fontSize: "0.74rem", fontWeight: 650, marginBottom: "0.4rem" }}>
                Matched evidence
              </span>
              <div className="talent-pool-tags">
                {evaluation.matched_keywords.map((skill) => (
                  <span key={skill}>{skill}</span>
                ))}
              </div>
            </div>
          )}

          {hasHeadhunterEvidence ? (
            <div>
              <span style={{ display: "block", color: "var(--ink-72)", fontSize: "0.74rem", fontWeight: 650, marginBottom: "0.4rem" }}>
                Headhunter evaluation
              </span>
              <div className="headhunter-evaluation">
                <div className="headhunter-evaluation-head">
                  <span className="candidate-avatar">
                    {headhunterInitials(headhunter!.name)}
                  </span>
                  <div>
                    <strong>{headhunter!.name}</strong>
                    <small>{headhunter!.persona}</small>
                  </div>
                </div>
                <p className="headhunter-evaluation-summary">
                  {evaluation!.match_summary ?? "Sourced from your talent pool."}
                </p>
                <div className="headhunter-evaluation-meta">
                  <span>Talent pool · AI sourced</span>
                  <span>{timeAgo(evaluation!.created_at)}</span>
                </div>
              </div>
            </div>
          ) : (
            evaluation?.match_summary && (
              <div>
                <div className="aura-summary">
                  <p className="aura-summary-label">
                    <span className="aura-summary-icon" aria-hidden="true">✦</span>
                    Summarized by Aura
                  </p>
                  <p>{evaluation.match_summary}</p>
                </div>
              </div>
            )
          )}
        </div>

        <footer>
          <small>Quick preview — open Details for the full evaluation.</small>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <Link
              href={`/employer/candidates/${entry.id}`}
              className="btn btn-primary"
            >
              Details →
            </Link>
          </div>
        </footer>
      </section>
    </div>
  );
}
