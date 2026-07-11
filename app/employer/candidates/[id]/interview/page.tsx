"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Loader } from "@/components/ui/loader";
import { interviewEvaluationPriorities } from "../../../data";
import {
  employerApi,
  type CandidateDetail,
  type CandidateRow,
} from "@/lib/employerApi";
import styles from "./InterviewEvaluation.module.css";

function scoreTone(score: number) {
  if (score >= 90) return styles.strong;
  if (score >= 80) return styles.good;
  if (score >= 70) return styles.fair;
  return styles.weak;
}

export default function CandidateInterviewEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getCandidate(id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (failed)
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
        <Loader label="Loading interview evaluation…" />
      </div>
    );

  const row: CandidateRow | undefined = detail.rows.find(
    (r) => r.evaluation?.interview_evaluation,
  );
  const evaluation = row?.evaluation?.interview_evaluation;
  const name = detail.full_name ?? detail.email ?? "Candidate";

  if (!row || !evaluation)
    return (
      <div className="employer-page">
        <Link href={`/employer/candidates/${id}`} className="back-link">
          ← Candidate evaluation
        </Link>
        <div className="empty-state panel">
          <h3>No interview evaluation yet</h3>
          <p>{name} hasn&apos;t attempted the mock interview for your roles.</p>
        </div>
      </div>
    );

  const scores = evaluation.scores ?? {};
  const scoredPriorities = interviewEvaluationPriorities.filter(
    (metric) => scores[metric.key] != null,
  );
  const totalPriority = scoredPriorities.reduce(
    (total, metric) => total + metric.priority,
    0,
  );
  const finalScore = totalPriority
    ? Math.round(
        scoredPriorities.reduce(
          (total, metric) => total + (scores[metric.key] ?? 0) * metric.priority,
          0,
        ) / totalPriority,
      )
    : Math.round(row.evaluation?.interview_score ?? 0);

  return (
    <div className="employer-page">
      <Link href={`/employer/candidates/${id}`} className="back-link">
        ← Candidate evaluation
      </Link>

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Mock interview evaluation</p>
          <h1>{name}</h1>
          <p>
            {row.job_title}
            {evaluation.completedAt ? ` · Completed ${evaluation.completedAt}` : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className="btn btn-ghost"
            href={`/employer/interviews/${row.job_id}/customize`}
          >
            View interview setup
          </Link>
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
            <h2>Interview evidence</h2>
            <p>{evaluation.summary}</p>
          </div>
        </section>

        <section className={`panel ${styles.sessionDetails}`}>
          <h2>Session details</h2>
          <dl>
            <div>
              <dt>Role</dt>
              <dd>{row.job_title}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{evaluation.completedAt ?? "—"}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{evaluation.duration ?? "—"}</dd>
            </div>
            <div>
              <dt>Response mode</dt>
              <dd>{evaluation.mode ?? "—"}</dd>
            </div>
          </dl>
        </section>
      </div>

      {scoredPriorities.length > 0 && (
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
            <Link href={`/employer/interviews/${row.job_id}/customize`}>
              Customize future interviews →
            </Link>
          </div>

          <div className={styles.indexGrid}>
            {scoredPriorities.map((metric) => {
              const score = scores[metric.key] ?? 0;
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
      )}

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
              {(evaluation.responses ?? []).map((response, index) => (
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
              {(evaluation.responses ?? []).length === 0 && (
                <p style={{ color: "var(--ink-55)" }}>
                  No per-question transcript recorded for this attempt.
                </p>
              )}
            </div>
          </section>
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">Aura observation</p>
            <h3>Response consistency</h3>
            <p className={styles.asideCopy}>
              Interview analytics support comparison and review. Evidence is
              drawn only from the recorded responses above.
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
