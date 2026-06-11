import Link from "next/link";
import { notFound } from "next/navigation";
import {
  candidates,
  defaultMetricPriorities,
  evaluationMetrics,
  scoringDimensions,
  weightedScore,
} from "../../data";

function scoreTone(score: number) {
  if (score >= 90) return "strong";
  if (score >= 80) return "good";
  if (score >= 70) return "fair";
  return "weak";
}

function scoreColor(score: number) {
  if (score >= 90) return "var(--score-strong)";
  if (score >= 80) return "var(--score-good)";
  if (score >= 70) return "var(--score-fair)";
  return "var(--score-weak)";
}

export default async function CandidateDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) notFound();

  const wlcScore = weightedScore(candidate.rubric);

  return (
    <div className="employer-page">
      <Link href="/employer/candidates" className="back-link">
        ← All candidates
      </Link>
      <div className="candidate-profile-head panel">
        <div className="candidate-profile-person">
          <span className="candidate-avatar candidate-avatar-large">
            {candidate.initials}
          </span>
          <div>
            <div className="candidate-name-row">
              <h1>{candidate.name}</h1>
              <span className="chip chip-tier-high">High confidence</span>
            </div>
            <p>
              {candidate.role} · {candidate.location} · {candidate.experience}
            </p>
            <div className="candidate-skill-row">
              {candidate.skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="candidate-profile-actions">
          <select className="select" defaultValue={candidate.stage}>
            <option>New</option>
            <option>Screening</option>
            <option>Assessment</option>
            <option>Interview</option>
            <option>Final review</option>
            <option>Offer</option>
          </select>
          <button className="btn btn-primary">Message candidate</button>
        </div>
      </div>

      <div className="candidate-evaluation-summary">
        <section className="panel candidate-wlc-hero">
          <div
            className={`evaluation-score-ring ${scoreTone(wlcScore)}`}
            style={{
              background: `radial-gradient(circle, var(--surface) 59%, transparent 60%), conic-gradient(${scoreColor(wlcScore)} 0 ${wlcScore}%, var(--ink-06) ${wlcScore}% 100%)`,
            }}
          >
            <strong>{wlcScore}</strong>
            <span>
              {candidate.interviewAttempted ? "WLC score" : "Provisional"}
            </span>
          </div>
          <div>
            <p className="eyebrow">Weighted Linear Combination</p>
            <h2>
              {candidate.interviewAttempted
                ? "Strong evidence across the full hiring model"
                : "Application-based evaluation"}
            </h2>
            <p>
              {candidate.interviewAttempted
                ? "Six evaluation metrics supply evidence into four awarded dimensions. Those four weighted scores produce this single final result."
                : "This score uses available resume, profile, preference, and risk evidence. Interview-derived evidence remains optional and is not treated as zero."}
            </p>
            <code>
              Technical 38% + Problem solving 25% + Communication 20% +
              Culture/system 17% = {wlcScore}/100
            </code>
          </div>
        </section>
        <section className="panel evaluation-confidence">
          <span
            className={`attention-icon ${candidate.interviewAttempted ? "green" : "warm"}`}
          >
            {candidate.interviewAttempted ? "✓" : "!"}
          </span>
          <div>
            <strong>
              {candidate.interviewAttempted
                ? "High-confidence evaluation"
                : "Interview evidence optional"}
            </strong>
            <p>
              {candidate.interviewAttempted
                ? "Resume, mock interview, and preference signals are complete. No material contradictions detected."
                : "The candidate has not attempted the mock interview. Review can continue using the evidence currently available."}
            </p>
          </div>
        </section>
      </div>

      <section className="panel employer-section evaluation-metrics-section">
        <div className="employer-section-head">
          <div>
            <p className="eyebrow">Scoring evidence</p>
            <h2>Evaluation metrics</h2>
            <p>
              These findings inform the four dimension scores below; they are
              not calculated as a second score.
            </p>
          </div>
          <Link href="/employer/jobs/senior-product-designer/edit">
            Configure priorities →
          </Link>
        </div>
        <div className="evaluation-metric-grid">
          {evaluationMetrics.map((metric) => {
            const score = candidate.metrics[metric.key];
            const priority = defaultMetricPriorities[metric.key];
            if (metric.key === "reputation" && !candidate.interviewAttempted)
              return (
                <article
                  key={metric.key}
                  className="evaluation-metric-card unavailable"
                >
                  <div>
                    <span>{metric.label}</span>
                    <strong>—</strong>
                  </div>
                  <p>{metric.description}</p>
                  <div className="evaluation-meter" />
                  <footer>
                    <span>Priority {priority}/10</span>
                    <b>Not available</b>
                  </footer>
                </article>
              );
            return (
              <article
                key={metric.key}
                className={`evaluation-metric-card ${scoreTone(score)}`}
              >
                <div>
                  <span>{metric.label}</span>
                  <strong>{score}</strong>
                </div>
                <p>{metric.description}</p>
                <div className="evaluation-meter">
                  <i style={{ width: `${score}%` }} />
                </div>
                <footer>
                  <span>Priority {priority}/10</span>
                  <b>Evidence input</b>
                </footer>
              </article>
            );
          })}
        </div>
        <div className="evidence-to-score-arrow">
          <span>Evaluation evidence above</span>
          <b>↓ awarded into the four dimensions below ↓</b>
        </div>
        <div className="final-dimension-grid">
          {scoringDimensions.map((dimension) => {
            const score = candidate.rubric[dimension.key];
            const contribution = ((score * dimension.weight) / 100).toFixed(1);
            return (
              <article key={dimension.key}>
                <header>
                  <div>
                    <strong>{dimension.label}</strong>
                    <p>{dimension.description}</p>
                  </div>
                  <span>{score}</span>
                </header>
                <div className="dimension-meter">
                  <i style={{ width: `${score}%` }} />
                </div>
                <footer>
                  <b>{dimension.weight}% weight</b>
                  <span>Contributes {contribution} points</span>
                </footer>
              </article>
            );
          })}
        </div>
        <div className="final-score-equation">
          <span>Final WLC score</span>
          <code>
            {scoringDimensions
              .map(
                (dimension) =>
                  `${candidate.rubric[dimension.key]} × ${dimension.weight}%`,
              )
              .join(" + ")}
          </code>
          <strong>= {wlcScore}</strong>
        </div>
      </section>

      <div className="candidate-detail-grid candidate-evaluation-grid">
        <main>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Aura assessment</p>
                <h2>Why {candidate.name.split(" ")[0]} stands out</h2>
              </div>
            </div>
            <p className="assessment-lede">
              A strong, evidence-backed match with consistent signals across
              portfolio depth, role-specific skills, and structured interview
              responses.
            </p>
            <div className="evidence-list">
              <div>
                <span>01</span>
                <p>
                  <strong>Direct problem-space experience</strong>Led end-to-end
                  product work in a comparable B2B environment, including
                  discovery, prototyping, and launch measurement.
                </p>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>High interview consistency</strong>Examples were
                  specific and measurable, with clear ownership and thoughtful
                  trade-off reasoning.
                </p>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>North Star alignment</strong>Career direction, team
                  preferences, growth expectations, and role outcomes are
                  closely aligned.
                </p>
              </div>
            </div>
          </section>

          {candidate.interviewAttempted && (
            <section className="panel employer-section">
              <div className="employer-section-head">
                <div>
                  <h2>Mock interview evidence</h2>
                  <p>
                    Feeds reputational score and the relevant scoring dimensions
                  </p>
                </div>
                <Link href="/employer/interviews">View transcript →</Link>
              </div>
              <div className="interview-highlights">
                <blockquote>
                  “I measure design quality by whether the team can make better
                  decisions after the work, not only by whether the interface
                  looks polished.”
                </blockquote>
              </div>
            </section>
          )}

          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <h2>ATS resume evidence</h2>
                <p>Semantic match against employer-prioritized keywords</p>
              </div>
              <span className="quality-score">
                {candidate.metrics.match}% match
              </span>
            </div>
            <div className="ats-keywords">
              {candidate.matchedKeywords.map((keyword, index) => (
                <span key={keyword}>
                  <i>{index < 3 ? "Priority" : "Matched"}</i>
                  {keyword}
                  <b>✓</b>
                </span>
              ))}
            </div>
            <p className="ats-note">
              Aura matched contextual evidence and related terminology, not only
              exact keyword repetition.
            </p>
          </section>
        </main>

        <aside>
          <section className="panel employer-section decision-log">
            <div className="employer-section-head">
              <div>
                <h2>Evaluation log</h2>
                <p>Traceable scoring activity</p>
              </div>
            </div>
            <ol>
              <li>
                <i />
                <div>
                  <strong>
                    {candidate.interviewAttempted
                      ? "WLC score calculated"
                      : "Provisional score calculated"}
                  </strong>
                  <span>Today, 10:42 AM · Aura</span>
                </div>
              </li>
              {candidate.interviewAttempted && (
                <li>
                  <i />
                  <div>
                    <strong>Mock interview evaluated</strong>
                    <span>Today, 10:39 AM · {candidate.interview}/100</span>
                  </div>
                </li>
              )}
              <li>
                <i />
                <div>
                  <strong>ATS resume match completed</strong>
                  <span>
                    Today, 10:31 AM · {candidate.matchedKeywords.length}{" "}
                    priority terms
                  </span>
                </div>
              </li>
              {candidate.applied && (
                <li>
                  <i />
                  <div>
                    <strong>Application received</strong>
                    <span>Yesterday, 4:18 PM</span>
                  </div>
                </li>
              )}
            </ol>
          </section>
          <section className="panel employer-section profile-note">
            <h3>Compensation alignment</h3>
            <p>Candidate expectation</p>
            <strong>RM 13k–15k / month</strong>
            <small>
              Within the approved role range. Candidate values learning budget
              and flexible work.
            </small>
          </section>
          <section className="panel employer-section red-flag-card">
            <div>
              <span className="attention-icon green">✓</span>
              <strong>Low red-flag risk</strong>
            </div>
            <p>
              Employment timeline is consistent. Responses contain specific
              examples and no detected answer-pattern anomalies.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
