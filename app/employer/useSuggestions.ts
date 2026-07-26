"use client";

import { useEffect, useMemo, useState } from "react";
import { defaultPipelinePhases, isInShortlistWindow, isJobOpen } from "@/app/employer/data";
import { currentPhaseProgress, getJobConfig, nextPhaseId } from "@/app/employer/pipelineConfig";
import {
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type EmployerJobPlan,
  type Offer,
  type PhaseDef,
  type SuggestedAction,
} from "@/lib/employerApi";

export type SuggestionPriority = "high" | "medium" | "low";

export type Suggestion = {
  id: string;
  tone: string;
  priority: SuggestionPriority;
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

/** Everything this hook needs to compute the alert list — extracted from the
 * former /employer/suggested-actions page so the same rule set now feeds the
 * dashboard's AlertsBoard instead of a standalone nav page. Rule logic is
 * unchanged; only `priority` is new (a genuine urgency tier, distinct from
 * `tone`, which was topic-coloring, not severity). */
export function useSuggestions() {
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
      if (profileRes.status === "fulfilled" && profileRes.value.hiring_pipeline_phases?.length)
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

      // 1. Offer-phase jobs → review the offer console. High: a decision is
      // actively blocking the pipeline.
      if (job.pipeline_phase === "offer-decision") {
        const shortlist = jobCandidates.filter(
          (row) => row.application && !row.application.is_rejected,
        );
        const alreadySent = sentFor(job.id).size;
        list.push({
          id: `offer-${job.id}`,
          tone: "peach",
          priority: "high",
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

      // 1b. Evaluation-phase jobs with a shortlist waiting on a decision.
      // High: this is where automation deliberately stops (backend
      // pipeline_engine.AUTOMATION_HANDOFF_PHASE) — Aura has finished
      // shortlisting and nothing else moves until the employer picks, so it
      // has to be visible on the dashboard, not just as a nav badge.
      if (job.pipeline_phase === "evaluation") {
        const waiting = jobCandidates.filter(
          (row) =>
            row.application &&
            !row.application.selected_for_offer &&
            isInShortlistWindow(
              row.application.stage,
              row.application.is_rejected,
              row.job_application_stages ?? job.job_application_stages,
            ),
        );
        if (waiting.length > 0) {
          const byAura = waiting.filter((row) => row.application?.shortlist_reason).length;
          list.push({
            id: `shortlist-${job.id}`,
            tone: "iris",
            priority: "high",
            badge: `${waiting.length}`,
            title: `Decide the shortlist for ${job.title}`,
            detail:
              byAura > 0
                ? `Aura shortlisted ${byAura} candidate${byAura === 1 ? "" : "s"} — choose who moves through to an offer.`
                : `${waiting.length} candidate${waiting.length === 1 ? " is" : "s are"} waiting on an offer decision.`,
            href: `/employer/shortlists`,
            cta: "Open shortlists →",
          });
        }
      }

      // 2. Manual phases whose target is met → advance the job. High: blocks
      // the job from moving forward until someone clicks.
      const config = getJobConfig(job, phases, plansByJob[job.id]?.openings ?? 1);
      const progress = currentPhaseProgress(job, candidates, config);
      const next = nextPhaseId(job.pipeline_phase, phases);
      if (progress && progress.automation === "manual" && progress.met && next) {
        list.push({
          id: `advance-${job.id}`,
          tone: "iris",
          priority: "high",
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

      // 3. Top unreviewed candidate for an actively-hiring job. Medium.
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
            priority: "medium",
            badge: `${Math.round(top.evaluation!.wlc_score!)}%`,
            title: `${top.full_name ?? top.email ?? "A candidate"} is a strong match for ${job.title}`,
            detail: `Aura scored them ${Math.round(top.evaluation!.wlc_score!)}% — worth a closer look.`,
            href: `/employer/candidates/${top.candidate_user_id}?job=${job.id}`,
            cta: "Review candidate →",
          });
        }
      }

      // 4. Actively-hiring job with no workforce plan. Medium.
      if (isJobOpen(job) && !plansByJob[job.id]) {
        list.push({
          id: `plan-${job.id}`,
          tone: "warm",
          priority: "medium",
          badge: "!",
          title: `Set a workforce plan for ${job.title}`,
          detail: "No headcount, budget, or pipeline targets defined yet.",
          href: `/employer/workforce/${job.id}`,
          cta: "Start planning →",
        });
      }

      // 5. Job still in planning → post it to start hiring. High: hiring
      // hasn't even started yet.
      if (job.pipeline_phase === "planning" && next) {
        list.push({
          id: `post-${job.id}`,
          tone: "iris",
          priority: "high",
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

      // 6. Mock interviews completed and waiting for a human review. Medium.
      const interviewed = jobCandidates.filter(
        (row) => row.evaluation?.interview_evaluation,
      ).length;
      if (isJobOpen(job) && interviewed > 0) {
        list.push({
          id: `interviews-${job.id}`,
          tone: "mint",
          priority: "medium",
          badge: `${interviewed}`,
          title: `${interviewed} interview${interviewed === 1 ? "" : "s"} to review for ${job.title}`,
          detail: "Mock interview scorecards are ready for your read.",
          href: `/employer/jobs/${job.id}/applicants?activity=interview`,
          cta: "Review interviews →",
        });
      }
    }

    // 7. Candidates awaiting evaluation (across all jobs). Medium.
    const awaiting = candidates.filter(
      (row) => row.application && !row.evaluation,
    ).length;
    if (awaiting > 0) {
      list.push({
        id: "awaiting-eval",
        tone: "iris",
        priority: "medium",
        badge: `${awaiting}`,
        title: "Candidates awaiting evaluation",
        detail: `${awaiting} application${awaiting === 1 ? "" : "s"} without a score yet.`,
        href: "/employer/candidates",
        cta: "Review candidates →",
      });
    }

    // 8. Headhunter-sourced candidates worth a look. Low.
    const headhunterPicks = candidates
      .filter((row) => row.evaluation?.source === "headhunter")
      .slice(0, 3);
    for (const pick of headhunterPicks) {
      list.push({
        id: `hh-${pick.job_id}-${pick.candidate_user_id}`,
        tone: "peach",
        priority: "low",
        badge: "✦",
        title: `${pick.full_name ?? pick.email ?? "A candidate"} was sourced by a headhunter`,
        detail: `Suggested for ${pick.job_title}. Review the match and reach out.`,
        href: `/employer/candidates/${pick.candidate_user_id}?job=${pick.job_id}`,
        cta: "Review candidate →",
      });
    }

    // 9. Re-engage previously-rejected candidates from the talent pool. Low.
    const rejected = candidates.filter((row) => row.application?.is_rejected).length;
    if (rejected > 0) {
      list.push({
        id: "reengage",
        tone: "warm",
        priority: "low",
        badge: `${rejected}`,
        title: "Re-engage past candidates in your talent pool",
        detail: `${rejected} previously-rejected candidate${rejected === 1 ? "" : "s"} may fit a new role.`,
        href: "/employer/talent-pool",
        cta: "Open talent pool →",
      });
    }

    // 10. Persisted agent suggestions (candidate-management / HR supervisor).
    // A ready-to-send draft or a pending score is high; everything else medium.
    const jobTitle = Object.fromEntries(jobs.map((j) => [j.id, j.title]));
    for (const a of persisted) {
      const href = a.candidate_user_id
        ? `/employer/candidates/${a.candidate_user_id}${a.job_id ? `?job=${a.job_id}` : ""}`
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
        priority: hasDraft || isScoreCandidate ? "high" : "medium",
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

    const PRIORITY_RANK: Record<SuggestionPriority, number> = { high: 0, medium: 1, low: 2 };
    return list
      .filter((item) => !done.has(item.id))
      .sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
    // tick forces recompute after an inline action mutates server state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, jobs, candidates, plans, phases, phaseLabel, done, tick, persisted, offersByJob]);

  function dismiss(item: Suggestion) {
    if (item.dismiss) return item.dismiss();
    setDone((current) => new Set(current).add(item.id));
    return undefined;
  }

  return { suggestions, loading, dismiss };
}
