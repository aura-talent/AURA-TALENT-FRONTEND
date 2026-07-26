"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import {
  defaultApplicationStages,
  evaluationMetrics,
  scoringDimensions,
} from "../../data";
import {
  candidateInitials,
  employerApi,
  timeAgo,
  type CandidateDetail,
  type CandidateRow,
} from "@/lib/employerApi";
import CandidateEmailComposer from "@/components/employer/CandidateEmailComposer";
import StageTracker from "@/components/employer/StageTracker";
import { setBreadcrumbLabel } from "@/components/employer/Breadcrumbs";
import BountyCandidateHistory from "@/components/employer/BountyCandidateHistory";

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

export default function CandidateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  // A candidate can sit on several of this employer's jobs, each with its own
  // evaluation. Pages that link here from a job context pass ?job=<id> so the
  // evaluation shown is the one for the job the employer came from — without
  // it this page just picked whichever row happened to come back first.
  const jobIdParam = useSearchParams().get("job");
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getCandidate(id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (detail) setBreadcrumbLabel(id, detail.full_name ?? detail.email ?? "Candidate");
  }, [id, detail]);

  if (notFound)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Candidate not found</h3>
        </div>
      </div>
    );
  if (!detail)
    return (
      <div className="employer-page">
        <Loader label="Loading candidate…" />
      </div>
    );

  // The job the employer navigated from wins outright. Otherwise prefer the
  // row with an application (the active pipeline context), then fall back to
  // the best-scored evaluation row.
  const row: CandidateRow | undefined =
    (jobIdParam ? detail.rows.find((r) => r.job_id === jobIdParam) : undefined) ??
    detail.rows.find((r) => r.application) ??
    detail.rows[0];
  // Carry the job context into the resume/interview sub-pages so they resolve
  // to the same job's evaluation rather than re-guessing.
  const jobQuery = row?.job_id ? `?job=${row.job_id}` : "";
  const evaluation = row?.evaluation ?? null;
  const application = row?.application ?? null;
  const stages = row?.job_application_stages?.length
    ? row.job_application_stages
    : defaultApplicationStages;
  const interviewAttempted = Boolean(
    evaluation?.interview_evaluation || evaluation?.interview_score != null,
  );

  const name = detail.full_name ?? detail.email ?? "Candidate";
  const wlcScore = evaluation?.wlc_score != null ? Math.round(evaluation.wlc_score) : null;
  const rubric = evaluation?.rubric ?? null;
  const metrics = evaluation?.metrics ?? null;
  const weights = Object.fromEntries(scoringDimensions.map((d) => [d.key, d.weight]));

  return (
    <div className="employer-page">
      <div className="candidate-profile-head panel">
        <div className="candidate-profile-top">
          <div className="candidate-profile-person">
            <span className="candidate-avatar candidate-avatar-large">
              {candidateInitials(detail.full_name)}
            </span>
            <div>
              <div className="candidate-name-row">
                <h1>{name}</h1>
              </div>
              <p>
                {row ? row.job_title : "No role context yet"}
                {detail.email ? ` · ${detail.email}` : ""}
              </p>
              <div className="candidate-skill-row">
                {(evaluation?.matched_keywords ?? []).slice(0, 5).map((skill) => (
                  <span className="chip" key={skill}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="candidate-profile-actions">
            {detail.resume_markdown ? (
              <Link
                className="btn btn-ghost"
                href={`/employer/candidates/${id}/resume${jobQuery}`}
              >
                View resume
              </Link>
            ) : (
              <span className="resume-unavailable">Resume not submitted</span>
            )}
            <CandidateEmailComposer
              candidateName={name}
              role={row?.job_title ?? "your application"}
              score={wlcScore ?? 0}
              candidateUserId={detail.candidate_user_id}
              jobId={row?.job_id}
            />
          </div>
        </div>
        {application && (
          <div className="candidate-profile-stage-row">
            <StageTracker
              initialStage={application.stage}
              stages={stages}
              onStageChange={(stage) =>
                employerApi.moveStage(application.id, stage).then(() => undefined)
              }
            />
            <Link
              href={`/employer/jobs/${row!.job_id}/stages`}
              className="table-action"
            >
              Configure stages →
            </Link>
          </div>
        )}
      </div>

      <div className="candidate-evaluation-summary">
        <section className="panel candidate-wlc-hero">
          {wlcScore != null ? (
            <div
              className={`evaluation-score-ring ${scoreTone(wlcScore)}`}
              style={{
                background: `radial-gradient(circle, var(--surface) 59%, transparent 60%), conic-gradient(${scoreColor(wlcScore)} 0 ${wlcScore}%, var(--ink-06) ${wlcScore}% 100%)`,
              }}
            >
              <strong>{wlcScore}</strong>
              <span>{interviewAttempted ? "WLC score" : "Provisional"}</span>
            </div>
          ) : (
            <div className="evaluation-score-ring weak">
              <strong>—</strong>
              <span>Not scored</span>
            </div>
          )}
          <div>
            <p className="eyebrow">Weighted Linear Combination</p>
            <h2>
              {wlcScore == null
                ? "No evaluation yet"
                : interviewAttempted
                  ? "Strong evidence across the full hiring model"
                  : "Application-based evaluation"}
            </h2>
            <p>
              {wlcScore == null
                ? "This candidate hasn't been evaluated against this role yet."
                : interviewAttempted
                  ? "Six evaluation metrics supply evidence into four awarded dimensions. Those four weighted scores produce this single final result."
                  : "This score uses available resume, profile, preference, and risk evidence. Interview-derived evidence remains optional and is not treated as zero."}
            </p>
            {rubric && (
              <code>
                {scoringDimensions
                  .map((d) => `${d.label.split(" ")[0]} ${weights[d.key]}%`)
                  .join(" + ")}{" "}
                = {wlcScore}/100
              </code>
            )}
          </div>
        </section>
        <section className="panel evaluation-confidence">
          <span className={`attention-icon ${interviewAttempted ? "green" : "warm"}`}>
            {interviewAttempted ? "✓" : "!"}
          </span>
          <div>
            <strong>
              {interviewAttempted
                ? "High-confidence evaluation"
                : "Interview evidence optional"}
            </strong>
            <p>
              {interviewAttempted
                ? "Resume, mock interview, and preference signals are complete."
                : "The candidate has not attempted the mock interview. Review can continue using the evidence currently available."}
            </p>
          </div>
        </section>
      </div>

      {metrics && rubric && (
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
            {row && (
              <Link href={`/employer/jobs/${row.job_id}/edit`}>
                Configure priorities →
              </Link>
            )}
          </div>
          <div className="evaluation-metric-grid">
            {evaluationMetrics.map((metric) => {
              const score = metrics[metric.key];
              if (score == null)
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
                    <strong>{Math.round(score)}</strong>
                  </div>
                  <p>{metric.description}</p>
                  <div className="evaluation-meter">
                    <i style={{ width: `${score}%` }} />
                  </div>
                  <footer>
                    <span>Evidence input</span>
                    <b>{metric.key === "redFlags" ? "Inverted" : ""}</b>
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
              const score = rubric[dimension.key] ?? 0;
              const contribution = ((score * weights[dimension.key]) / 100).toFixed(1);
              return (
                <article key={dimension.key}>
                  <header>
                    <div>
                      <strong>{dimension.label}</strong>
                      <p>{dimension.description}</p>
                    </div>
                    <span>{Math.round(score)}</span>
                  </header>
                  <div className="dimension-meter">
                    <i style={{ width: `${score}%` }} />
                  </div>
                  <footer>
                    <b>{weights[dimension.key]}% weight</b>
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
                .map((d) => `${Math.round(rubric[d.key] ?? 0)} × ${weights[d.key]}%`)
                .join(" + ")}
            </code>
            <strong>= {wlcScore}</strong>
          </div>
        </section>
      )}

      <div className="candidate-detail-grid candidate-evaluation-grid">
        <main>
          {evaluation && (
            <section className="panel employer-section">
              <div className="employer-section-head">
                <div>
                  <p className="eyebrow">Aura assessment</p>
                  <h2>Why {name.split(" ")[0]} stands out</h2>
                </div>
              </div>
              <p className="assessment-lede">
                {evaluation.match_summary ??
                  "Evaluation evidence is available below."}
              </p>
              <div className="evidence-list">
                {evaluation.evidence.slice(0, 5).map((item, index) => (
                  <div key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {interviewAttempted && (
            <section className="panel employer-section">
              <div className="employer-section-head">
                <div>
                  <h2>Mock interview evidence</h2>
                  <p>
                    Feeds reputational score and the relevant scoring dimensions
                  </p>
                </div>
                <Link href={`/employer/candidates/${id}/interview${jobQuery}`}>
                  View interview evaluation →
                </Link>
              </div>
              <div className="interview-highlights">
                <blockquote>
                  {evaluation?.interview_evaluation?.summary ??
                    "Interview evaluation available."}
                </blockquote>
              </div>
            </section>
          )}

          {evaluation && (
            <section className="panel employer-section">
              <div className="employer-section-head">
                <div>
                  <h2>ATS resume evidence</h2>
                  <p>Semantic match against employer-prioritized keywords</p>
                </div>
                {metrics?.match != null && (
                  <span className="quality-score">
                    {Math.round(metrics.match)}% match
                  </span>
                )}
              </div>
              <div className="ats-keywords">
                {evaluation.matched_keywords.map((keyword, index) => (
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
          )}
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
              {evaluation && (
                <li>
                  <i />
                  <div>
                    <strong>
                      {interviewAttempted
                        ? "WLC score calculated"
                        : "Provisional score calculated"}
                    </strong>
                    <span>{timeAgo(evaluation.updated_at)} · Aura</span>
                  </div>
                </li>
              )}
              {interviewAttempted && evaluation && (
                <li>
                  <i />
                  <div>
                    <strong>Mock interview evaluated</strong>
                    <span>
                      {Math.round(evaluation.interview_score ?? 0)}/100
                    </span>
                  </div>
                </li>
              )}
              {application && (
                <li>
                  <i />
                  <div>
                    <strong>Application received</strong>
                    <span>{timeAgo(application.applied_at)}</span>
                  </div>
                </li>
              )}
            </ol>
          </section>
          {detail.rows.length > 1 && (
            <section className="panel employer-section profile-note">
              <h3>Other roles</h3>
              {detail.rows
                .filter((r) => r !== row)
                .map((r) => (
                  <p key={r.job_id}>
                    {r.job_title}
                    {r.evaluation?.wlc_score != null &&
                      ` · ${Math.round(r.evaluation.wlc_score)} match`}
                  </p>
                ))}
            </section>
          )}
          <BountyCandidateHistory candidateUserId={detail.candidate_user_id} />
          {evaluation && metrics?.redFlags != null && (
            <section className="panel employer-section red-flag-card">
              <div>
                <span className={`attention-icon ${metrics.redFlags >= 70 ? "green" : "warm"}`}>
                  {metrics.redFlags >= 70 ? "✓" : "!"}
                </span>
                <strong>
                  {metrics.redFlags >= 70 ? "Low red-flag risk" : "Review red flags"}
                </strong>
              </div>
              <p>
                Red-flag confidence {Math.round(metrics.redFlags)}/100 — higher
                means lower observed risk.
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
