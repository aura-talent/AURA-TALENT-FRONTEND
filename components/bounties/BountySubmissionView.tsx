"use client";

import { useEffect, useState } from "react";
import {
  bountyApi,
  formatPrize,
  type Bounty,
  type SubmissionWithResult,
} from "@/lib/bountyApi";
import BountySubmissionForm from "@/components/bounties/BountySubmissionForm";

interface Props {
  bounty: Bounty;
  submission: SubmissionWithResult;
  candidateUserId: string;
  candidateEmail: string;
  onSaved: (submission: SubmissionWithResult) => void;
}

export default function BountySubmissionView({
  bounty,
  submission,
  candidateUserId,
  candidateEmail,
  onSaved,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [loadingFiles, setLoadingFiles] = useState(true);

  const result = submission.result;
  const isWinner = result?.status === "winner";
  const deadlinePassed = Boolean(bounty.deadline && new Date(bounty.deadline).getTime() < Date.now());

  useEffect(() => {
    let cancelled = false;
    async function loadFiles() {
      const urls: Record<string, string> = {};
      for (const item of bounty.requirement_items) {
        const resp = submission.responses[item.id];
        if (resp && resp.type === "file" && resp.value) {
          try {
            const url = await bountyApi.getSignedFileUrl(resp.value);
            urls[resp.value] = url;
          } catch (err) {
            console.error("Failed to load file url:", err);
          }
        }
      }
      if (!cancelled) {
        setFileUrls(urls);
        setLoadingFiles(false);
      }
    }
    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [bounty, submission]);

  function statusChip() {
    if (isWinner) {
      return (
        <span
          className="chip"
          style={{
            background: "rgba(23, 133, 92, 0.12)",
            color: "var(--score-strong)",
            border: "1px solid rgba(23, 133, 92, 0.3)",
            fontWeight: 700,
          }}
        >
          🏆 Winner · Rank {result.rank} ({formatPrize(result.prize_amount ?? 0, bounty.currency)})
        </span>
      );
    }
    if (result?.status === "not_selected") {
      return (
        <span
          className="chip"
          style={{
            background: "rgba(217, 83, 79, 0.12)",
            color: "var(--score-weak)",
            border: "1px solid rgba(217, 83, 79, 0.3)",
          }}
        >
          Not selected
        </span>
      );
    }
    return (
      <span
        className="chip"
        style={{
          background: "var(--iris-08)",
          color: "var(--iris)",
          border: "1px solid var(--iris-20)",
          fontWeight: 600,
        }}
      >
        ⏳ Pending Review
      </span>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Existing Submission Card */}
      <section className="panel employer-section" style={{ position: "relative" }}>
        <span className="eval-tick eval-tick-tl" />
        <span className="eval-tick eval-tick-tr" />
        <span className="eval-tick eval-tick-bl" />
        <span className="eval-tick eval-tick-br" />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.25rem" }}>
          <div>
            <div className="page-kicker" style={{ marginBottom: "0.25rem" }}>
              YOUR_SUBMITTED_ENTRY
            </div>
            <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700 }}>Submission Details</h2>
            <div style={{ fontSize: "0.8rem", color: "var(--ink-55)", marginTop: "0.25rem" }}>
              Submitted on {new Date(submission.submitted_at).toLocaleDateString()} at {new Date(submission.submitted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div>{statusChip()}</div>
        </div>

        {/* Candidate Details & Team Members */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.25rem", background: "var(--porcelain)", padding: "1rem", borderRadius: "6px", border: "1px solid var(--ink-08)" }}>
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Contact Name</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>{submission.contact_name}</div>
          </div>
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Contact Email</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>{submission.contact_email}</div>
          </div>
          {submission.team_members.length > 0 && (
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Team Members</div>
              <div style={{ fontSize: "0.875rem", color: "var(--ink-80)", marginTop: "0.2rem" }}>
                {submission.team_members.map((m) => `${m.name} (${m.email})`).join(", ")}
              </div>
            </div>
          )}
        </div>

        {/* Responses Summary List */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.75rem" }}>
            Submitted Answers & Files:
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {bounty.requirement_items.map((item) => {
              const resp = submission.responses[item.id];
              return (
                <div key={item.id} style={{ background: "#fff", padding: "0.85rem", borderRadius: "6px", border: "1px solid var(--ink-10)" }}>
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink-80)", marginBottom: "0.25rem" }}>
                    {item.label} <span style={{ fontSize: "0.7rem", color: "var(--ink-40)", fontWeight: 400 }}>({item.type})</span>
                  </div>
                  {!resp ? (
                    <div style={{ fontSize: "0.85rem", color: "var(--ink-40)", fontStyle: "italic" }}>No response submitted</div>
                  ) : resp.type === "link" ? (

                    <a
                      href={resp.value}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: "0.875rem", color: "var(--iris)", fontWeight: 600, textDecoration: "underline", wordBreak: "break-all" }}
                    >
                      {resp.value} ↗
                    </a>
                  ) : resp.type === "file" ? (
                    <div>
                      {loadingFiles ? (
                        <span style={{ fontSize: "0.85rem", color: "var(--ink-55)" }}>Loading file link…</span>
                      ) : fileUrls[resp.value] ? (
                        <a
                          href={fileUrls[resp.value]}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost"
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.35rem 0.75rem", fontSize: "0.8rem", color: "var(--iris)" }}
                        >
                          📄 Download Submitted File ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: "0.85rem", color: "var(--ink-55)" }}>File uploaded ({resp.value.split("/").pop()})</span>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: "0.875rem", color: "var(--ink-90)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {resp.value}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Candidate Notes */}
        {submission.notes && (
          <div style={{ marginBottom: "1.25rem", background: "var(--porcelain)", padding: "0.85rem", borderRadius: "6px", border: "1px solid var(--ink-08)" }}>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ink-55)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.25rem" }}>
              Submission Notes
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--ink-80)" }}>{submission.notes}</div>
          </div>
        )}

        {/* Toggle Edit Button */}
        {!deadlinePassed && (
          <div style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--ink-08)", display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setEditing(!editing)}
              style={{ fontSize: "0.85rem" }}
            >
              {editing ? "Cancel Editing" : "✏️ Edit / Update Submission"}
            </button>
          </div>
        )}
      </section>

      {/* Edit Form if toggled */}
      {editing && !deadlinePassed && (
        <BountySubmissionForm
          bounty={bounty}
          candidateUserId={candidateUserId}
          candidateEmail={candidateEmail}
          existing={submission}
          onSaved={(updated) => {
            onSaved({ ...submission, ...updated });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}
