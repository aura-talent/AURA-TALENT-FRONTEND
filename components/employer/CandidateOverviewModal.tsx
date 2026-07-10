import Link from "next/link";
import {
  candidates,
  headhunterInitials,
  headhunterSuggestions,
  headhunters,
  talentPoolProfiles,
} from "@/app/employer/data";
import StageChip from "./StageChip";

type Candidate = (typeof candidates)[number];

// Deterministic, templated stand-in for a real AI-generated blurb — shown
// whenever a candidate has no headhunter evidence to display instead.
function auraSummary(candidate: Candidate): string {
  const tier =
    candidate.score >= 90
      ? "an exceptional"
      : candidate.score >= 80
        ? "a strong"
        : candidate.score >= 70
          ? "a solid"
          : "an emerging";
  const topSkills = candidate.skills.slice(0, 2).join(" and ");
  const interviewNote = candidate.interviewAttempted
    ? "Interview evidence reinforces the resume signal."
    : "No interview evidence yet — this reflects resume and profile signals only.";
  return `Aura sees ${tier} match for ${candidate.role}, anchored by ${topSkills}. ${interviewNote}`;
}

export default function CandidateOverviewModal({
  candidate,
  onClose,
}: {
  candidate: Candidate;
  onClose: () => void;
}) {
  const profile = talentPoolProfiles[candidate.id];
  const suggestion = headhunterSuggestions[candidate.id];
  const headhunter = suggestion
    ? headhunters.find((item) => item.id === suggestion.headhunterId)
    : undefined;
  const hasHeadhunterEvidence = Boolean(suggestion && headhunter);

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
            <h2 id="candidate-overview-title">{candidate.name}</h2>
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
              {candidate.initials}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-72)" }}>
                {candidate.role} · {candidate.location} · {candidate.experience}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.5rem" }}>
                <StageChip stage={candidate.stage} />
                {candidate.interviewAttempted ? (
                  <span className="chip chip-tier-high">✓ Interview</span>
                ) : (
                  <span className="signal-missing">No interview</span>
                )}
              </div>
            </div>
            <span className="candidate-score" style={{ flexShrink: 0 }}>
              <b style={{ fontSize: "1.9rem" }}>{candidate.score}%</b>
              <small>match</small>
            </span>
          </div>

          <div>
            <span style={{ display: "block", color: "var(--ink-72)", fontSize: "0.74rem", fontWeight: 650, marginBottom: "0.4rem" }}>
              Skills
            </span>
            <div className="talent-pool-tags">
              {candidate.skills.map((skill) => (
                <span key={skill}>{skill}</span>
              ))}
            </div>
          </div>

          {profile && (
            <div>
              <span style={{ display: "block", color: "var(--ink-72)", fontSize: "0.74rem", fontWeight: 650, marginBottom: "0.4rem" }}>
                Talent pool context
              </span>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-55)", lineHeight: 1.55 }}>
                {profile.previousOutcome} — {profile.reason}
              </p>
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
                <p className="headhunter-evaluation-summary">{suggestion!.summary}</p>
                <div className="talent-pool-tags">
                  {suggestion!.keyStrengths.map((strength) => (
                    <span key={strength}>{strength}</span>
                  ))}
                </div>
                <div className="headhunter-evaluation-meta">
                  <span>{suggestion!.sourcedFrom}</span>
                  <span>{suggestion!.sourcedAt}</span>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="aura-summary">
                <p className="aura-summary-label">
                  <span className="aura-summary-icon" aria-hidden="true">✦</span>
                  Summarized by Aura
                </p>
                <p>{auraSummary(candidate)}</p>
              </div>
            </div>
          )}
        </div>

        <footer>
          <small>Quick preview — open Details for the full evaluation.</small>
          <div>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
            <Link
              href={`/employer/candidates/${candidate.id}`}
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
