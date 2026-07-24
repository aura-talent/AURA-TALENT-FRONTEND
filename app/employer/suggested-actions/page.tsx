"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { defaultPipelinePhases, isJobOpen } from "@/app/employer/data";
import {
  currentPhaseProgress,
  getJobConfig,
  nextPhaseId,
} from "@/app/employer/pipelineConfig";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type EmployerJobPlan,
  type Offer,
  type PhaseDef,
  type SuggestedAction,
} from "@/lib/employerApi";
import { Loader } from "@/components/ui/loader";

type Suggestion = {
  id: string;
  tone: string;
  badge: string;
  title: string;
  detail: string;
  href?: string;
  cta?: string;
  draft?: { subject: string; body: string };
  action?: { label: string; run: () => void | Promise<void> };
  dismiss?: () => void | Promise<void>;
};

// Kinds whose payload carries a ready draft_subject/draft_body (drafted by
// the candidate-management agent) — executing sends it for real.
const SEND_KINDS = new Set(["send_interview_invite", "follow_up", "recommend_offer"]);

export default function SuggestedActionsPage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [plans, setPlans] = useState<EmployerJobPlan[]>([]);
  const [phases, setPhases] = useState<PhaseDef[]>(defaultPipelinePhases);
  const [offersByJob, setOffersByJob] = useState<Record<string, Set<string>>>({});
  const [persisted, setPersisted] = useState<SuggestedAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.listJobs(),
      employerApi.listCandidates(),
      employerApi.listJobPlans(),
      employerApi.getProfile(),
      employerApi.listSuggestedActions("open"),
    ]).then(async ([jobsRes, candidatesRes, plansRes, profileRes, actionsRes]) => {
      if (cancelled) return;
      const loadedJobs = jobsRes.status === "fulfilled" ? jobsRes.value : [];
      if (jobsRes.status === "fulfilled") setJobs(loadedJobs);
      if (candidatesRes.status === "fulfilled") setCandidates(candidatesRes.value);
      if (plansRes.status === "fulfilled") setPlans(plansRes.value);
      if (
        profileRes.status === "fulfilled" &&
        profileRes.value.hiring_pipeline_phases?.length
      )
        setPhases(profileRes.value.hiring_pipeline_phases);
      if (actionsRes.status === "fulfilled") setPersisted(actionsRes.value);

      // Offers, per job (replaces the aura.offersSent localStorage store).
      const offerLists = await Promise.allSettled(
        loadedJobs.map((job) => employerApi.listOffers(job.id)),
      );
      if (cancelled) return;
      const map: Record<string, Set<string>> = {};
      offerLists.forEach((res, i) => {
        if (res.status === "fulfilled")
          map[loadedJobs[i].id] = new Set(
            (res.value as Offer[]).map((o) => o.candidate_user_id),
          );
      });
      setOffersByJob(map);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sentFor = (jobId: string): Set<string> => offersByJob[jobId] ?? new Set();

  const phaseLabel = useMemo(
    () => Object.fromEntries(phases.map((phase) => [phase.id, phase.label])),
    [phases],
  );

  const suggestions = useMemo<Suggestion[]>(() => {
    if (loading) return [];
    const plansByJob = Object.fromEntries(plans.map((plan) => [plan.job_id, plan]));
    const list: Suggestion[] = [];

    for (const job of jobs) {
      const jobCandidates = candidates.filter((row) => row.job_id === job.id);

      // 1. Offer-phase jobs → review the offer console.
      if (job.pipeline_phase === "offer-decision") {
        const shortlist = jobCandidates.filter(
          (row) => row.application && !row.application.is_rejected,
        );
        const alreadySent = sentFor(job.id).size;
        list.push({
          id: `offer-${job.id}`,
          tone: "peach",
          badge: `${shortlist.length}`,
          title: `Review offers for ${job.title}`,
          detail:
            alreadySent > 0
              ? `${alreadySent} offer${alreadySent === 1 ? "" : "s"} sent · ${shortlist.length} shortlisted`
              : `${shortlist.length} shortlisted candidate${shortlist.length === 1 ? "" : "s"} ready for an offer decision`,
          href: `/employer/offers?job=${job.id}`,
          cta: "Open offer console →",
        });
      }

      // 2. Manual phases whose target is met → advance the job.
      const config = getJobConfig(job, phases, plansByJob[job.id]?.openings ?? 1);
      const progress = currentPhaseProgress(job, candidates, config);
      const next = nextPhaseId(job.pipeline_phase, phases);
      if (progress && progress.automation === "manual" && progress.met && next) {
        list.push({
          id: `advance-${job.id}`,
          tone: "iris",
          badge: "✓",
          title: `Advance ${job.title} to ${phaseLabel[next] ?? next}`,
          detail: `Target met — ${progress.currentCount}/${progress.targetCount}. Ready to move to the next phase.`,
          action: {
            label: `Advance to ${phaseLabel[next] ?? next}`,
            run: async () => {
              await employerApi.advancePhase(job.id, { to_phase: next });
              setTick((n) => n + 1);
            },
          },
        });
      }

      // 3. Top unreviewed candidate for an actively-hiring job.
      if (isJobOpen(job)) {
        const sent = sentFor(job.id);
        const top = [...jobCandidates]
          .filter(
            (row) =>
              row.evaluation?.wlc_score != null &&
              !sent.has(row.candidate_user_id) &&
              !(row.application && /hire/i.test(row.application.stage)),
          )
          .sort(
            (a, b) => (b.evaluation?.wlc_score ?? 0) - (a.evaluation?.wlc_score ?? 0),
          )[0];
        if (top && (top.evaluation?.wlc_score ?? 0) >= 75) {
          list.push({
            id: `top-${job.id}`,
            tone: "mint",
            badge: `${Math.round(top.evaluation!.wlc_score!)}%`,
            title: `${top.full_name ?? top.email ?? "A candidate"} is a strong match for ${job.title}`,
            detail: `Aura scored them ${Math.round(top.evaluation!.wlc_score!)}% — worth a closer look.`,
            href: `/employer/candidates/${top.candidate_user_id}`,
            cta: "Review candidate →",
          });
        }
      }

      // 4. Actively-hiring job with no workforce plan.
      if (isJobOpen(job) && !plansByJob[job.id]) {
        list.push({
          id: `plan-${job.id}`,
          tone: "warm",
          badge: "!",
          title: `Set a workforce plan for ${job.title}`,
          detail: "No headcount, budget, or pipeline targets defined yet.",
          href: `/employer/workforce/${job.id}`,
          cta: "Start planning →",
        });
      }

      // 5. Job still in planning → post it to start hiring.
      if (job.pipeline_phase === "planning" && next) {
        list.push({
          id: `post-${job.id}`,
          tone: "iris",
          badge: "▶",
          title: `Post ${job.title} to start hiring`,
          detail: "This role is still in planning. Move it into active hiring to begin receiving applicants.",
          action: {
            label: `Move to ${phaseLabel[next] ?? next}`,
            run: async () => {
              await employerApi.advancePhase(job.id, { to_phase: next });
              setTick((n) => n + 1);
            },
          },
        });
      }

      // 6. Mock interviews completed and waiting for a human review.
      const interviewed = jobCandidates.filter(
        (row) => row.evaluation?.interview_evaluation,
      ).length;
      if (isJobOpen(job) && interviewed > 0) {
        list.push({
          id: `interviews-${job.id}`,
          tone: "mint",
          badge: `${interviewed}`,
          title: `${interviewed} interview${interviewed === 1 ? "" : "s"} to review for ${job.title}`,
          detail: "Mock interview scorecards are ready for your read.",
          href: `/employer/jobs/${job.id}/applicants?activity=interview`,
          cta: "Review interviews →",
        });
      }
    }

    // 7. Candidates awaiting evaluation (across all jobs).
    const awaiting = candidates.filter(
      (row) => row.application && !row.evaluation,
    ).length;
    if (awaiting > 0) {
      list.push({
        id: "awaiting-eval",
        tone: "iris",
        badge: `${awaiting}`,
        title: "Candidates awaiting evaluation",
        detail: `${awaiting} application${awaiting === 1 ? "" : "s"} without a score yet.`,
        href: "/employer/candidates",
        cta: "Review candidates →",
      });
    }

    // 8. Headhunter-sourced candidates worth a look.
    const headhunterPicks = candidates
      .filter((row) => row.evaluation?.source === "headhunter")
      .slice(0, 3);
    for (const pick of headhunterPicks) {
      list.push({
        id: `hh-${pick.job_id}-${pick.candidate_user_id}`,
        tone: "peach",
        badge: "✦",
        title: `${pick.full_name ?? pick.email ?? "A candidate"} was sourced by a headhunter`,
        detail: `Suggested for ${pick.job_title}. Review the match and reach out.`,
        href: `/employer/candidates/${pick.candidate_user_id}`,
        cta: "Review candidate →",
      });
    }

    // 9. Re-engage previously-rejected candidates from the talent pool.
    const rejected = candidates.filter((row) => row.application?.is_rejected).length;
    if (rejected > 0) {
      list.push({
        id: "reengage",
        tone: "warm",
        badge: `${rejected}`,
        title: "Re-engage past candidates in your talent pool",
        detail: `${rejected} previously-rejected candidate${rejected === 1 ? "" : "s"} may fit a new role.`,
        href: "/employer/talent-pool",
        cta: "Open talent pool →",
      });
    }

    // 10. Persisted agent suggestions (candidate-management / HR supervisor).
    const jobTitle = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
    for (const a of persisted) {
      const href = a.candidate_user_id
        ? `/employer/candidates/${a.candidate_user_id}`
        : a.job_id
          ? `/employer/jobs/${a.job_id}`
          : undefined;
      const payload = a.payload as { draft_subject?: string; draft_body?: string };
      const hasDraft = SEND_KINDS.has(a.kind) && !!payload.draft_subject && !!payload.draft_body;
      const isScoreCandidate = a.kind === "score_candidate";
      const id = `agent-${a.id}`;
      list.push({
        id,
        tone: "iris",
        badge: "✦",
        title: a.title,
        detail:
          a.body ??
          `Suggested by Aura${a.job_id && jobTitle[a.job_id] ? ` for ${jobTitle[a.job_id]}` : ""}.`,
        draft: hasDraft ? { subject: payload.draft_subject!, body: payload.draft_body! } : undefined,
        action: {
          label: hasDraft ? "Confirm & send" : isScoreCandidate ? "Score now" : "Mark done",
          run: async () => {
            if (hasDraft || isScoreCandidate) await employerApi.executeSuggestedAction(a.id);
            else await employerApi.updateSuggestedAction(a.id, "done");
            setDone((current) => new Set(current).add(id));
          },
        },
        dismiss: async () => {
          await employerApi.updateSuggestedAction(a.id, "dismissed");
          setDone((current) => new Set(current).add(id));
        },
        href,
        cta: href ? "Open →" : undefined,
      });
    }

    return list.filter((item) => !done.has(item.id));
    // tick forces recompute after an inline action mutates server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, jobs, candidates, plans, phases, phaseLabel, done, tick, persisted, offersByJob]);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Aura</p>
          <h1>Suggested actions</h1>
          <p>
            The highest-impact moves across your pipeline right now — offers to
            review, jobs ready to advance, and candidates worth a look.
          </p>
        </div>
        {!loading && (
          <span className="chip chip-tier-high">{suggestions.length} suggestions</span>
        )}
      </div>

      {loading ? (
        <div className="panel">
          <Loader label="Gathering suggestions…" />
        </div>
      ) : suggestions.length === 0 ? (
        <div className="empty-state panel">
          <h3>You&apos;re all caught up</h3>
          <p>No actions need your attention right now. Aura will surface more as your pipeline moves.</p>
        </div>
      ) : (
        <div className="suggested-actions-list">
          {suggestions.map((item) => (
            <article className="panel suggested-action-card" key={item.id}>
              <span className={`suggested-action-badge ${item.tone}`}>{item.badge}</span>
              <div className="suggested-action-body">
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                {item.draft && (
                  <div className="suggested-action-draft">
                    <strong>{item.draft.subject}</strong>
                    <p>{item.draft.body}</p>
                  </div>
                )}
              </div>
              {item.href && item.cta && (
                <Link href={item.href} className="table-action">
                  {item.cta}
                </Link>
              )}
              {item.action && (
                <div className="suggested-action-controls">
                  <button
                    className="btn btn-primary"
                    onClick={() => item.action!.run()}
                  >
                    {item.action.label}
                  </button>
                  <button
                    className="btn btn-ghost"
                    onClick={() =>
                      item.dismiss
                        ? item.dismiss()
                        : setDone((current) => new Set(current).add(item.id))
                    }
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
