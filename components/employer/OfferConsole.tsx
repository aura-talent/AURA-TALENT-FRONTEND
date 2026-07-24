"use client";

import { useEffect, useState } from "react";
import {
  candidateInitials,
  employerApi,
  type CandidateRow,
  type EmployerJob,
} from "@/lib/employerApi";
import StageChip from "@/components/employer/StageChip";
import CandidateEmailComposer from "@/components/employer/CandidateEmailComposer";
import { Loader } from "@/components/ui/loader";

export default function OfferConsole({ job }: { job: EmployerJob }) {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    employerApi
      .listCandidates(job.id)
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .listOffers(job.id)
      .then((offers) => {
        if (cancelled) return;
        setSent(new Set(offers.map((o) => o.candidate_user_id)));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  // The one-view shortlist: everyone still in the running for this role, best
  // match first. Rejected applications drop out.
  const shortlist = rows
    .filter((row) => row.application && !row.application.is_rejected)
    .sort(
      (a, b) => (b.evaluation?.wlc_score ?? -1) - (a.evaluation?.wlc_score ?? -1),
    );

  const offerStage = job.job_application_stages?.find(
    (stage) => !stage.is_rejected && /offer/i.test(stage.label),
  );

  async function sendOffer(row: CandidateRow) {
    const cid = row.candidate_user_id;
    setSent((current) => new Set(current).add(cid));
    try {
      // Record the offer (real offers row, status='sent').
      await employerApi.createOffer(job.id, cid);
    } catch (err) {
      console.error("Failed to record offer:", err);
      setSent((current) => {
        const next = new Set(current);
        next.delete(cid);
        return next;
      });
      return;
    }
    // Advance the candidate's application to the offer stage if the job has
    // one configured — keeps the pipeline and the offer console in sync.
    if (offerStage && row.application && row.application.stage !== offerStage.label) {
      try {
        await employerApi.moveStage(row.application.id, offerStage.label);
      } catch (err) {
        console.error("Failed to move candidate to offer stage:", err);
      }
    }
  }

  return (
    <div className="employer-page">

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Offer console</p>
          <h1>Offers · {job.title}</h1>
          <p>
            Every candidate still in the running, best match first. Aura drafts
            the offer — <strong>sending is always your call</strong>.
          </p>
        </div>
        <span className="chip chip-tier-high">
          {shortlist.length} shortlisted
        </span>
      </div>

      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading shortlist…" />
        ) : shortlist.length === 0 ? (
          <div className="empty-state">
            <h3>No candidates to offer yet</h3>
            <p>Candidates appear here once they&apos;ve applied and cleared rejection.</p>
          </div>
        ) : (
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
              {shortlist.map((row) => {
                const score = row.evaluation?.wlc_score;
                const offerSent = sent.has(row.candidate_user_id);
                return (
                  <tr key={row.candidate_user_id}>
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
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
                        <CandidateEmailComposer
                          candidateName={row.full_name ?? row.email ?? "Candidate"}
                          role={job.title}
                          score={score != null ? Math.round(score) : 0}
                          candidateUserId={row.candidate_user_id}
                          jobId={job.id}
                          categoryFilter="Offer"
                          buttonLabel="Draft offer"
                          buttonClassName="btn btn-ghost"
                        />
                        <button
                          className="btn btn-primary"
                          disabled={offerSent}
                          onClick={() => sendOffer(row)}
                        >
                          {offerSent ? "Offer sent ✓" : "Send offer"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
