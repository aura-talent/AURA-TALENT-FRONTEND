"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type JobApplication,
  type PhaseDef,
} from "@/lib/employerApi";
import {
  defaultPipelinePhases,
  isInShortlistWindow,
  rejectedStageLabel,
  shortlistInvite,
  stageColor,
} from "@/app/employer/data";
import { currentPhaseProgress, getJobConfig } from "@/app/employer/pipelineConfig";
import CandidateEmailComposer from "@/components/employer/CandidateEmailComposer";
import { Loader } from "@/components/ui/loader";
import styles from "./Shortlists.module.css";

/**
 * Cross-job shortlist queue — candidates sitting between the Shortlisted and
 * Offer stages on a job that's in its Evaluation phase. Each row offers the
 * one move its current stage allows (invite to interview, then to assessment)
 * alongside the two decisions available at any point: choose for offer, or
 * reject. Anyone past the offer step is no longer this page's business.
 */

/** Score band, matching the --score-* tokens the rest of the app reads. */
function scoreClass(score: number | null | undefined): string {
  if (score == null) return styles.scoreNone;
  if (score >= 80) return styles.scoreStrong;
  if (score >= 65) return styles.scoreGood;
  if (score >= 50) return styles.scoreFair;
  return styles.scoreWeak;
}

export default function ShortlistsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [phases, setPhases] = useState<PhaseDef[]>(defaultPipelinePhases);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.listJobs(),
      employerApi.listCandidates(),
      employerApi.getProfile(),
    ]).then(([jobsRes, rowsRes, profileRes]) => {
      if (cancelled) return;
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
      if (rowsRes.status === "fulfilled") setRows(rowsRes.value);
      if (profileRes.status === "fulfilled" && profileRes.value.hiring_pipeline_phases?.length)
        setPhases(profileRes.value.hiring_pipeline_phases);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => {
    return jobs
      .filter((job) => job.pipeline_phase === "evaluation")
      .map((job) => ({
        job,
        items: rows
          .filter(
            (row) =>
              row.job_id === job.id &&
              row.application &&
              isInShortlistWindow(
                row.application.stage,
                row.application.is_rejected,
                row.job_application_stages ?? job.job_application_stages,
              ),
          )
          // Strongest match first — the score is the instrument of this
          // decision, so it sets the reading order.
          .sort((a, b) => (b.evaluation?.wlc_score ?? -1) - (a.evaluation?.wlc_score ?? -1)),
      }))
      .filter((group) => group.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length);
  }, [jobs, rows]);

  const undecided = groups.reduce(
    (sum, g) => sum + g.items.filter((row) => !row.application?.selected_for_offer).length,
    0,
  );

  /** Runs one application mutation, keyed by application id so only that
   * row's controls disable while it's in flight. */
  async function mutate(
    applicationId: string,
    run: () => Promise<JobApplication>,
    failure: string,
  ) {
    setBusy((s) => new Set(s).add(applicationId));
    setError(null);
    try {
      const updated = await run();
      setRows((current) =>
        current.map((r) => (r.application?.id === applicationId ? { ...r, application: updated } : r)),
      );
    } catch {
      setError(failure);
    } finally {
      setBusy((s) => {
        const copy = new Set(s);
        copy.delete(applicationId);
        return copy;
      });
    }
  }

  function toggleSelectForOffer(application: JobApplication) {
    mutate(
      application.id,
      () => employerApi.selectForOffer(application.id, !application.selected_for_offer),
      "That selection didn't save. Try again.",
    );
  }

  function reject(application: JobApplication, stage: string) {
    mutate(
      application.id,
      () => employerApi.moveStage(application.id, stage),
      "Couldn't reject this candidate. Try again.",
    );
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Jobs · Action</p>
          <h1>Shortlists</h1>
          <p>
            Roles in Evaluation, and the candidates who made their shortlist. Choose who moves
            on to an offer.
          </p>
        </div>
        {!loading && groups.length > 0 && (
          <div className={styles.summary}>
            <span className={styles.summaryCount}>{undecided}</span>
            <span className={styles.summaryLabel}>
              {undecided === 1 ? "still to decide" : "still to decide"}
            </span>
          </div>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {loading ? (
        <div className="panel">
          <Loader label="Loading shortlists…" />
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state panel">
          <h3>No shortlists open</h3>
          <p>
            Candidates land here once a role reaches Evaluation and applicants move to the
            Shortlisted stage. Track roles from <Link href="/employer/jobs">Job Listing</Link>.
          </p>
        </div>
      ) : (
        groups.map(({ job, items }) => {
          const chosen = items.filter((row) => row.application?.selected_for_offer).length;
          const config = getJobConfig(job, phases);
          const progress = currentPhaseProgress(job, rows, config);
          const target = progress && !progress.isManualGate ? progress.targetCount : items.length;
          const ready = target > 0 && chosen >= target;
          const pct = target > 0 ? Math.min(100, (chosen / target) * 100) : 0;

          return (
            <section key={job.id} className={`panel ${styles.jobGroup}`}>
              <div className={styles.jobHead}>
                <div>
                  <h2 className={styles.jobTitle}>
                    <Link href={`/employer/jobs/${job.id}`}>{job.title}</Link>
                  </h2>
                  <p className={styles.jobMeta}>
                    {job.team ?? "No team"} · {job.location ?? "No location"}
                  </p>
                </div>
                <div className={styles.tally}>
                  <span className={`${styles.tallyCount} ${ready ? styles.tallyReady : ""}`}>
                    {chosen}/{target}
                  </span>
                  <span className={styles.tallyLabel}>
                    {ready ? "ready for offers" : "chosen for offer"}
                  </span>
                </div>
              </div>

              <div className={styles.rail}>
                <div
                  className={`${styles.railFill} ${ready ? styles.railFillReady : ""}`}
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className={styles.stack}>
                {items.map((row) => {
                  const application = row.application!;
                  const score = row.evaluation?.wlc_score;
                  const isChosen = application.selected_for_offer;
                  const working = busy.has(application.id);
                  const name = row.full_name ?? row.email ?? "Candidate";
                  const stages = row.job_application_stages ?? job.job_application_stages;
                  const invite = shortlistInvite(application.stage, stages);
                  const rejectStage = rejectedStageLabel(stages);

                  return (
                    <article
                      key={`${job.id}:${row.candidate_user_id}`}
                      className={`${styles.card} ${isChosen ? styles.cardChosen : ""}`}
                    >
                      <div className={styles.scoreWrap}>
                        <span className={styles.glow} aria-hidden="true" />
                        <span className={`${styles.score} ${scoreClass(score)}`}>
                          {score != null ? Math.round(score) : "—"}
                          {score != null && <span className={styles.scoreUnit}>%</span>}
                        </span>
                        <span className={styles.scoreLabel}>
                          {score != null ? "match" : "no score"}
                        </span>
                      </div>

                      <div>
                        <Link
                          className={styles.name}
                          href={`/employer/candidates/${row.candidate_user_id}?job=${job.id}`}
                        >
                          {name}
                        </Link>
                        {row.email && <span className={styles.email}>{row.email}</span>}
                        <span
                          className={styles.stage}
                          style={{ color: stageColor(application.stage, stages) }}
                        >
                          <span className={styles.stageDot} aria-hidden="true" />
                          {application.stage}
                        </span>
                      </div>

                      {/* Why they're on this list. Aura writes a per-candidate
                          rationale when it shortlists; a human moving someone
                          here by hand leaves none, so the cell reads as a dash
                          rather than pretending to an explanation. */}
                      <div className={styles.why}>
                        {application.shortlist_reason ? (
                          <>
                            <span className={styles.whoAura}>Shortlisted by Aura</span>
                            <p className={styles.whyText}>{application.shortlist_reason}</p>
                          </>
                        ) : (
                          <span className={styles.whyNone} title="Shortlisted manually">
                            —
                          </span>
                        )}
                      </div>

                      {/* Two tiers: the invitation this stage calls for sits
                          apart from the two decisions available at every
                          stage. The invite opens a drafted email — the
                          candidate advances when they reply, not on click. */}
                      <div className={styles.controls}>
                        {invite && (
                          <CandidateEmailComposer
                            candidateName={name}
                            role={job.title}
                            score={score != null ? Math.round(score) : undefined}
                            candidateUserId={row.candidate_user_id}
                            jobId={job.id}
                            buttonLabel={invite.label}
                            buttonClassName={styles.step}
                            categoryFilter={invite.category}
                            defaultPrompt={invite.instructions}
                          />
                        )}
                        <span
                          className={`${styles.decide} ${invite ? styles.decideDivided : ""}`}
                        >
                          <button
                            type="button"
                            className={`${styles.choose} ${isChosen ? styles.chooseOn : ""}`}
                            disabled={working}
                            aria-pressed={isChosen}
                            onClick={() => toggleSelectForOffer(application)}
                            title={
                              isChosen
                                ? `Remove ${name} from the offer list`
                                : `Send ${name} through to the Offer Console`
                            }
                          >
                            {working ? "Saving…" : isChosen ? "✓ Chosen" : "Choose for offer"}
                          </button>
                          {rejectStage && (
                            <button
                              type="button"
                              className={styles.reject}
                              disabled={working}
                              onClick={() => reject(application, rejectStage)}
                              title={`Reject ${name}`}
                            >
                              Reject
                            </button>
                          )}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
