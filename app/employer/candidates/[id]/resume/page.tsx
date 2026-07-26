"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import ReportView from "@/components/ReportView";
import { Loader } from "@/components/ui/loader";
import {
  employerApi,
  type CandidateDetail,
  type CandidateRow,
} from "@/lib/employerApi";
import styles from "./Resume.module.css";

export default function CandidateResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const jobIdParam = useSearchParams().get("job");
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
        <Loader label="Loading resume…" />
      </div>
    );

  const name = detail.full_name ?? detail.email ?? "Candidate";
  const row: CandidateRow | undefined =
    (jobIdParam ? detail.rows.find((r) => r.job_id === jobIdParam) : undefined) ??
    detail.rows.find((r) => r.evaluation) ??
    detail.rows[0];
  const evaluation = row?.evaluation ?? null;

  if (!detail.resume_markdown)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>No resume on file</h3>
          <p>{name} hasn&apos;t uploaded a resume yet.</p>
        </div>
      </div>
    );

  return (
    <div className="employer-page">

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Submitted application</p>
          <h1>{name}&apos;s resume</h1>
          <p>
            {row
              ? `Resume analyzed by Aura against ${row.job_title}.`
              : "Resume from the shared talent pool."}
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <main className={`panel ${styles.viewerPanel}`}>
          <ReportView markdown={detail.resume_markdown} />
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">ATS analysis</p>
            <div className={styles.matchScore}>
              <strong>
                {evaluation?.metrics?.match != null
                  ? `${Math.round(evaluation.metrics.match)}%`
                  : "—"}
              </strong>
              <span>Role match</span>
            </div>
            <p className={styles.note}>
              Aura found contextual evidence for the employer-prioritized
              skills, not only exact keyword repetition.
            </p>
          </section>
          <section className="panel employer-section">
            <h3>Matched evidence</h3>
            <div className={styles.matchedEvidence}>
              {(evaluation?.matched_keywords ?? []).map((keyword, index) => (
                <span key={keyword}>
                  <i>{index < 3 ? "Priority" : "Matched"}</i>
                  {keyword}
                  <b>✓</b>
                </span>
              ))}
              {(evaluation?.matched_keywords ?? []).length === 0 && (
                <span>No evaluation yet</span>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
