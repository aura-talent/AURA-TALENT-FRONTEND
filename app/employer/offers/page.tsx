"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  candidateInitials,
  employerApi,
  type CandidateRow,
  type EmployerJob,
  type Offer,
} from "@/lib/employerApi";
import StageChip from "@/components/employer/StageChip";
import CandidateEmailComposer from "@/components/employer/CandidateEmailComposer";
import { Loader } from "@/components/ui/loader";

const sortOptions = ["Top match", "Name A–Z", "Newest application"] as const;
type SortOption = (typeof sortOptions)[number];

const statusOptions = ["All candidates", "Pending offer", "Offer sent"] as const;
type StatusOption = (typeof statusOptions)[number];

const SHOW_COUNT = 5;

function offerKey(jobId: string, candidateUserId: string) {
  return `${jobId}:${candidateUserId}`;
}

function OffersHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const jobParam = searchParams.get("job");

  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  // Optimistic "just sent" keys, merged with the real offers list.
  const [sentKeys, setSentKeys] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [jobFilter, setJobFilter] = useState(jobParam ?? "All roles");
  const [statusFilter, setStatusFilter] = useState<StatusOption>("All candidates");
  const [sortBy, setSortBy] = useState<SortOption>("Top match");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.listJobs(),
      employerApi.listCandidates(undefined, { onlySelected: true }),
      employerApi.listOffers(),
    ]).then(([jobsRes, rowsRes, offersRes]) => {
      if (cancelled) return;
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
      if (rowsRes.status === "fulfilled") setRows(rowsRes.value);
      if (offersRes.status === "fulfilled") setOffers(offersRes.value);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const jobsById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);

  const offeredKeys = useMemo(
    () => new Set(offers.map((offer) => offerKey(offer.job_id, offer.candidate_user_id))),
    [offers],
  );

  // The backend already filters to selected_for_offer=true (only_selected)
  // — these defensive checks just guard against a stale-cache edge case
  // (e.g. rejected or hired after selection) rather than doing the primary
  // filtering job themselves.
  const shortlist = useMemo(
    () =>
      rows.filter(
        (row) =>
          row.application &&
          row.application.selected_for_offer &&
          !row.application.is_rejected &&
          !/hire/i.test(row.application.stage),
      ),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shortlist.filter((row) => {
      const offered =
        offeredKeys.has(offerKey(row.job_id, row.candidate_user_id)) ||
        sentKeys.has(offerKey(row.job_id, row.candidate_user_id));
      const matchesQuery =
        !q || `${row.full_name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(q);
      const matchesJob = jobFilter === "All roles" || row.job_id === jobFilter;
      const matchesStatus =
        statusFilter === "All candidates" ||
        (statusFilter === "Pending offer" && !offered) ||
        (statusFilter === "Offer sent" && offered);
      return matchesQuery && matchesJob && matchesStatus;
    });
  }, [shortlist, query, jobFilter, statusFilter, offeredKeys, sentKeys]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === "Name A–Z") {
      list.sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? ""));
    } else if (sortBy === "Newest application") {
      list.sort(
        (a, b) =>
          new Date(b.application?.applied_at ?? 0).getTime() -
          new Date(a.application?.applied_at ?? 0).getTime(),
      );
    } else {
      list.sort(
        (a, b) => (b.evaluation?.wlc_score ?? -1) - (a.evaluation?.wlc_score ?? -1),
      );
    }
    return list;
  }, [filtered, sortBy]);

  // Group by job, most-candidates-first, so the busiest pipelines surface first.
  const groups = useMemo(() => {
    const byJob = new Map<string, CandidateRow[]>();
    for (const row of sorted) {
      const list = byJob.get(row.job_id) ?? [];
      list.push(row);
      byJob.set(row.job_id, list);
    }
    return Array.from(byJob.entries())
      .map(([jobId, candidates]) => ({ job: jobsById.get(jobId), jobId, candidates }))
      .filter((group): group is { job: EmployerJob; jobId: string; candidates: CandidateRow[] } =>
        Boolean(group.job),
      )
      .sort((a, b) => b.candidates.length - a.candidates.length);
  }, [sorted, jobsById]);

  // Fires after CandidateEmailComposer actually sends the offer — the only
  // send path now. The composer's backend call already upserts the offers
  // row; this keeps this page's "Offer sent" status in sync without a
  // reload, and advances the candidate to the job's offer stage if it has one.
  async function markOfferSent(row: CandidateRow, job: EmployerJob) {
    setSentKeys((current) => new Set(current).add(offerKey(row.job_id, row.candidate_user_id)));
    const offerStage = job.job_application_stages?.find(
      (stage) => !stage.is_rejected && /offer/i.test(stage.label),
    );
    if (offerStage && row.application && row.application.stage !== offerStage.label) {
      try {
        await employerApi.moveStage(row.application.id, offerStage.label);
      } catch (err) {
        console.error("Failed to move candidate to offer stage:", err);
      }
    }
  }

  function toggleExpanded(jobId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Offer console</p>
          <h1>Offers</h1>
          <p>
            Candidates selected for offer during Evaluation, grouped by job,
            best match first. Aura drafts the offer —{" "}
            <strong>sending is always your call</strong>.
          </p>
        </div>
        <span className="chip chip-tier-high">{sorted.length} candidates</span>
      </div>

      <p style={{ fontSize: "0.78rem", color: "var(--ink-55)", margin: "-0.5rem 0 1.25rem" }}>
        ✦ Only candidates explicitly selected during Evaluation appear here — Aura selects
        automatically once a job&apos;s offer target is met, or select manually from the
        Applicants tab. Review each candidate before sending an offer.
      </p>

      <div className="candidate-toolbar panel">
        <label className="search-field">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search candidates"
            aria-label="Search candidates"
          />
        </label>
        <select
          className="select"
          aria-label="Filter by role"
          value={jobFilter}
          onChange={(event) => setJobFilter(event.target.value)}
        >
          <option value="All roles">All roles</option>
          {jobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.title}
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Filter by offer status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusOption)}
        >
          {statusOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Sort candidates"
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value as SortOption)}
        >
          {sortOptions.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
        <span className="candidate-result-count">{sorted.length} candidates</span>
      </div>

      {loading ? (
        <div className="panel">
          <Loader label="Loading offers…" />
        </div>
      ) : groups.length === 0 ? (
        <div className="empty-state panel">
          <h3>No candidates to offer yet</h3>
          <p>Candidates appear here once Aura or you have selected them during Evaluation.</p>
        </div>
      ) : (
        groups.map(({ job, jobId, candidates }) => {
          const isExpanded = expanded.has(jobId);
          const visible = isExpanded ? candidates : candidates.slice(0, SHOW_COUNT);
          return (
            <section
              key={jobId}
              className="panel candidate-table-wrap"
              style={{ marginBottom: "1.25rem" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  marginBottom: "0.9rem",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{job.title}</h2>
                  <p style={{ margin: "0.15rem 0 0", fontSize: "0.8rem", color: "var(--ink-55)" }}>
                    {job.team ?? "—"} · {job.location ?? "—"}
                  </p>
                </div>
                <span className="chip">{candidates.length} shortlisted</span>
              </div>
              <table className="table employer-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Stage</th>
                    <th>Match</th>
                    <th>Offer</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => {
                    const score = row.evaluation?.wlc_score;
                    const key = offerKey(row.job_id, row.candidate_user_id);
                    const offerSent = offeredKeys.has(key) || sentKeys.has(key);
                    return (
                      <tr
                        key={row.candidate_user_id}
                        onClick={() =>
                          router.push(
                            `/employer/candidates/${row.candidate_user_id}?job=${row.job_id}`,
                          )
                        }
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <div className="candidate-cell">
                            <span className="candidate-avatar">
                              {candidateInitials(row.full_name)}
                            </span>
                            <div>
                              <strong>{row.full_name ?? row.email ?? "Candidate"}</strong>
                              <small>{row.email ?? "—"}</small>
                            </div>
                          </div>
                        </td>
                        <td>
                          {row.application ? (
                            <StageChip
                              stage={row.application.stage}
                              stages={row.job_application_stages}
                            />
                          ) : (
                            <span className="signal-missing">—</span>
                          )}
                        </td>
                        <td>
                          <span className="signal-score">
                            {score != null ? `${Math.round(score)}%` : "—"}
                          </span>
                        </td>
                        <td onClick={(event) => event.stopPropagation()}>
                          <div
                            style={{
                              display: "flex",
                              gap: "0.5rem",
                              alignItems: "center",
                              justifyContent: "flex-end",
                            }}
                          >
                            {offerSent && <span className="chip chip-tier-high">Offer sent ✓</span>}
                            <CandidateEmailComposer
                              candidateName={row.full_name ?? row.email ?? "Candidate"}
                              role={job.title}
                              score={score != null ? Math.round(score) : 0}
                              candidateUserId={row.candidate_user_id}
                              jobId={job.id}
                              categoryFilter="Offer"
                              buttonLabel="Draft offer"
                              buttonClassName="btn btn-ghost"
                              onSent={() => markOfferSent(row, job)}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {candidates.length > SHOW_COUNT && (
                <div style={{ textAlign: "center", paddingTop: "0.75rem" }}>
                  <button className="btn btn-ghost" onClick={() => toggleExpanded(jobId)}>
                    {isExpanded ? "Show fewer" : `Show all ${candidates.length}`}
                  </button>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}

export default function OffersPage() {
  return (
    <Suspense>
      <OffersHub />
    </Suspense>
  );
}
