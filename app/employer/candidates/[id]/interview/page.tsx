import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import {
  candidates,
  interviewEvaluationPriorities,
  interviewEvaluations,
  jobs,
} from "../../../data";
import styles from "./InterviewEvaluation.module.css";

function scoreTone(score: number) {
  if (score >= 90) return styles.strong;
  if (score >= 80) return styles.good;
  if (score >= 70) return styles.fair;
  return styles.weak;
}

export default async function CandidateInterviewEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = candidates.find((item) => item.id === id);
  const evaluation = interviewEvaluations[id];

  if (!candidate || !candidate.interviewAttempted || !evaluation) notFound();

  const job = jobs.find((item) => item.id === candidate.jobId);
  const totalPriority = interviewEvaluationPriorities.reduce(
    (total, metric) => total + metric.priority,
    0,
  );
  const finalScore = Math.round(
    interviewEvaluationPriorities.reduce(
      (total, metric) =>
        total + evaluation.scores[metric.key] * metric.priority,
      0,
    ) / totalPriority,
  );

  return (
    <div className="employer-page">
      <Link href={`/employer/candidates/${candidate.id}`} className="back-link">
        ← Candidate evaluation
      </Link>

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Mock interview evaluation</p>
          <h1>{candidate.name}</h1>
          <p>
            {job?.title ?? candidate.role} · Completed {evaluation.completedAt}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className="btn btn-ghost"
            href={`/employer/interviews/${candidate.jobId}/customize`}
          >
            View interview setup
          </Link>
          <button className="btn btn-primary" type="button">
            Share evaluation
          </button>
        </div>
      </div>

      <div className={styles.heroGrid}>
        <section className={`panel ${styles.scoreHero}`}>
          <div
            className={`${styles.scoreRing} ${scoreTone(finalScore)}`}
            style={{ "--score": `${finalScore}%` } as CSSProperties}
          >
            <strong>{finalScore}</strong>
            <span>Interview score</span>
          </div>
          <div>
            <p className="eyebrow">Priority-weighted result</p>
            <h2>Strong, consistent interview evidence</h2>
            <p>{evaluation.summary}</p>
            <code>
              {interviewEvaluationPriorities
                .map(
                  (metric) =>
                    `${metric.label} ${evaluation.scores[metric.key]} × ${metric.priority}`,
                )
                .join(" + ")}
              {` ÷ ${totalPriority} = ${finalScore}`}
            </code>
          </div>
        </section>

        <section className={`panel ${styles.sessionDetails}`}>
          <h2>Session details</h2>
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{job?.title ?? candidate.role}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{evaluation.completedAt}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{evaluation.duration}</dd>
            </div>
            <div>
              <dt>Response mode</dt>
              <dd>{evaluation.mode}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="panel employer-section">
        <div className="employer-section-head">
          <div>
            <p className="eyebrow">Interview scoring model</p>
            <h2>Index priorities</h2>
            <p>
              These priorities were configured before the candidate attempted
              the interview and are read-only here.
            </p>
          </div>
          <Link href={`/employer/interviews/${candidate.jobId}/customize`}>
            Customize future interviews →
          </Link>
        </div>

        <div className={styles.indexGrid}>
          {interviewEvaluationPriorities.map((metric) => {
            const score = evaluation.scores[metric.key];
            return (
              <article className={scoreTone(score)} key={metric.key}>
                <header>
                  <span>{metric.label}</span>
                  <strong>{score}</strong>
                </header>
                <p>{metric.description}</p>
                <div className={styles.scoreMeter}>
                  <i style={{ width: `${score}%` }} />
                </div>
                <footer>
                  <span>Priority</span>
                  <b>{metric.priority}/10</b>
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <div className={styles.contentGrid}>
        <main>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Question evidence</p>
                <h2>Responses and evaluation</h2>
                <p>
                  Transcript excerpts and the evidence Aura used for each
                  question score.
                </p>
              </div>
            </div>

            <div className={styles.responseList}>
              {evaluation.responses.map((response, index) => (
                <article key={response.question}>
                  <header>
                    <span>Question {String(index + 1).padStart(2, "0")}</span>
                    <b className={scoreTone(response.score)}>
                      {response.score}/100
                    </b>
                  </header>
                  <h3>{response.question}</h3>
                  <blockquote>{response.response}</blockquote>
                  <footer>
                    <span>Aura evidence</span>
                    <p>{response.evidence}</p>
                  </footer>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">Aura observation</p>
            <h3>Response consistency</h3>
            <p className={styles.asideCopy}>
              Examples remained internally consistent across questions. No
              material answer-pattern anomalies or contradictory ownership
              claims were detected.
            </p>
          </section>
          <section className="panel employer-section">
            <p className="eyebrow">Review note</p>
            <h3>Human decision remains required</h3>
            <p className={styles.asideCopy}>
              Interview analytics support comparison and review. They should
              be considered with the resume, preferences, and role context.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
