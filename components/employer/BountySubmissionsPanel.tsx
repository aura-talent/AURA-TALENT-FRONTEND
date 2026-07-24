"use client";

import { useEffect, useState } from "react";
import {
  bountyApi,
  formatPrize,
  nextOpenRank,
  type Bounty,
  type SubmissionResult,
  type SubmissionWithResult,
} from "@/lib/bountyApi";
import BountyContactButton from "@/components/employer/BountyContactButton";

function SubmissionRow({
  bounty,
  submission,
  open,
  openRank,
  fileUrls,
  busy,
  onToggle,
  onMarkWinner,
  onRemoveWinner,
}: {
  bounty: Bounty;
  submission: SubmissionWithResult;
  open: boolean;
  openRank: number | null;
  fileUrls: Record<string, string>;
  busy: boolean;
  onToggle: () => void;
  onMarkWinner: () => void;
  onRemoveWinner: () => void;
}) {
  const result: SubmissionResult | null = submission.result;
  const isWinner = result?.status === "winner";

  return (
    <>
      <tr>
        <td>
          <strong>{submission.contact_name}</strong>
          <small>{submission.contact_email}</small>
        </td>
        <td>{new Date(submission.submitted_at).toLocaleDateString()}</td>
        <td>
          <span className={`chip ${isWinner ? "chip-tier-high" : ""}`}>
            {isWinner
              ? `Winner · Rank ${result!.rank}`
              : result?.status === "not_selected"
                ? "Not selected"
                : "Pending review"}
          </span>
        </td>
        <td>
          <button className="table-action" onClick={onToggle}>
            {open ? "Hide" : "Review"} →
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={4}>
            <div className="bounty-submission-detail">
              {submission.notes && <p>{submission.notes}</p>}
              {submission.team_members.length > 0 && (
                <p>
                  Team:{" "}
                  {submission.team_members
                    .map((member) => `${member.name} (${member.email})`)
                    .join(", ")}
                </p>
              )}
              <ul>
                {bounty.requirement_items.map((item) => {
                  const response = submission.responses[item.id];
                  return (
                    <li key={item.id}>
                      <strong>{item.label}: </strong>
                      {!response ? (
                        "—"
                      ) : response.type === "file" ? (
                        fileUrls[response.value] ? (
                          <a href={fileUrls[response.value]} target="_blank" rel="noreferrer">
                            Download
                          </a>
                        ) : (
                          "Loading file…"
                        )
                      ) : response.type === "link" ? (
                        <a href={response.value} target="_blank" rel="noreferrer">
                          {response.value}
                        </a>
                      ) : (
                        response.value
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="bounty-submission-actions">
                {!isWinner ? (
                  <button
                    className="btn btn-primary"
                    disabled={busy || openRank == null}
                    onClick={onMarkWinner}
                  >
                    {openRank == null
                      ? "All ranks assigned"
                      : `Mark as rank ${openRank} winner (${formatPrize(
                          bounty.winner_slots.find((slot) => slot.rank === openRank)?.prize_amount ??
                            0,
                          bounty.currency,
                        )})`}
                  </button>
                ) : (
                  <>
                    <button className="btn btn-ghost" disabled={busy} onClick={onRemoveWinner}>
                      Remove winner
                    </button>
                    <BountyContactButton
                      candidateName={submission.contact_name}
                      contactEmail={submission.contact_email}
                      bountyTitle={bounty.title}
                      prizeAmount={result!.prize_amount ?? 0}
                      currency={bounty.currency}
                    />
                  </>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function BountySubmissionsPanel({ bounty }: { bounty: Bounty }) {
  const [submissions, setSubmissions] = useState<SubmissionWithResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  function reload() {
    setLoading(true);
    bountyApi
      .listSubmissionsForBounty(bounty.id)
      .then(setSubmissions)
      .catch((err) => console.error("Failed to load submissions:", err))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [bounty.id]);

  async function toggleSubmission(submission: SubmissionWithResult) {
    const opening = openId !== submission.id;
    setOpenId(opening ? submission.id : null);
    if (!opening) return;
    for (const response of Object.values(submission.responses)) {
      if (response.type === "file" && !fileUrls[response.value]) {
        try {
          const url = await bountyApi.getSignedFileUrl(response.value);
          setFileUrls((current) => ({ ...current, [response.value]: url }));
        } catch (err) {
          console.error("Failed to sign file url:", err);
        }
      }
    }
  }

  async function markWinner(submission: SubmissionWithResult, rank: number) {
    const slot = bounty.winner_slots.find((s) => s.rank === rank);
    if (!slot) return;
    setBusyId(submission.id);
    try {
      await bountyApi.markWinner(submission.id, rank, slot.prize_amount);
      reload();
    } catch (err) {
      console.error("Failed to mark winner:", err);
    } finally {
      setBusyId(null);
    }
  }

  async function removeWinner(submission: SubmissionWithResult) {
    setBusyId(submission.id);
    try {
      await bountyApi.removeWinner(submission.id);
      reload();
    } catch (err) {
      console.error("Failed to remove winner:", err);
    } finally {
      setBusyId(null);
    }
  }

  const takenResults = submissions
    .map((s) => s.result)
    .filter((r): r is SubmissionResult => r != null);
  const openRank = nextOpenRank(bounty.winner_slots, takenResults);

  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Submissions</h2>
          <p>{submissions.length} received</p>
        </div>
      </div>

      {loading ? (
        <p>Loading submissions…</p>
      ) : submissions.length === 0 ? (
        <div className="empty-state">
          <h3>No submissions yet</h3>
        </div>
      ) : (
        <div className="candidate-table-wrap">
          <table className="table employer-table">
            <thead>
              <tr>
                <th>Candidate</th>
                <th>Submitted</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((submission) => (
                <SubmissionRow
                  key={submission.id}
                  bounty={bounty}
                  submission={submission}
                  open={openId === submission.id}
                  openRank={openRank}
                  fileUrls={fileUrls}
                  busy={busyId === submission.id}
                  onToggle={() => toggleSubmission(submission)}
                  onMarkWinner={() => openRank != null && markWinner(submission, openRank)}
                  onRemoveWinner={() => removeWinner(submission)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
