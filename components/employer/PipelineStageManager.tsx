"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { api, PIPELINE_STAGES, PIPELINE_REJECTED, EMPLOYER_STAGE_TO_CANDIDATE_STATUS } from "@/lib/api";

interface PipelineManagerProps {
  candidateName: string;
  jobTitle: string;
  initialStageIndex?: number;
  targetUserId?: string;
  targetAppId?: string;
}

export default function PipelineStageManger({
  candidateName,
  jobTitle,
  initialStageIndex = 0,
  targetUserId: initialTargetUserId,
  targetAppId: initialTargetAppId,
}: PipelineManagerProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(initialStageIndex);
  const [isRejected, setIsRejected] = useState(false);
  const [note, setNote] = useState("");

  // For demo linking to a real candidate in Supabase
  const [targetUserId, setTargetUserId] = useState(initialTargetUserId || "");
  const [targetAppId, setTargetAppId] = useState(initialTargetAppId || "");

  // Update state if props change (when real app finishes fetching)
  useEffect(() => {
    if (initialTargetUserId) setTargetUserId(initialTargetUserId);
    if (initialTargetAppId) setTargetAppId(initialTargetAppId);
  }, [initialTargetUserId, initialTargetAppId]);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const stages = PIPELINE_STAGES;

  const handleAdvanceStage = async () => {
    if (isRejected) return;
    const nextIndex = Math.min(currentStageIndex + 1, stages.length - 1);
    await pushUpdate(nextIndex, false);
  };

  const handleSetStage = async (index: number) => {
    if (isRejected) setIsRejected(false);
    await pushUpdate(index, false);
  };

  const handleReject = async () => {
    await pushUpdate(currentStageIndex, true);
  };

  const pushUpdate = async (stageIndex: number, rejected: boolean) => {
    setSaving(true);
    setSaved(false);
    setError("");
    const stageLabel = rejected ? PIPELINE_REJECTED.label : stages[stageIndex].label;
    const candidateUserId = targetUserId.trim();
    const candidateAppId = targetAppId.trim();

    try {
      if (candidateUserId) {
        // ── Real candidate: go through the backend API ────────────────────
        await api.postPipelineUpdate(candidateUserId, {
          employer_id: "employer-demo",
          candidate_user_id: candidateUserId,
          application_id: candidateAppId || null,
          candidate_name: candidateName,
          job_title: jobTitle,
          stage: stageLabel,
          stage_index: rejected ? -1 : stageIndex,
          note: note.trim(),
        });

        // Auto-move the candidate's tracker Kanban card
        if (candidateAppId) {
          const mappedStatus = rejected
            ? "Rejected"
            : EMPLOYER_STAGE_TO_CANDIDATE_STATUS[stageLabel];
          if (mappedStatus) {
            await api.updateCandidateTrackerStatus(
              candidateUserId,
              candidateAppId,
              mappedStatus,
              note.trim() || undefined,
            ).catch((err) =>
              console.warn("Auto-move tracker status failed (non-fatal):", err)
            );
          }
        }
      } else {
        // ── Mock / demo candidate: write directly to Supabase ────────────
        const { error: sbError } = await supabase
          .from("employer_pipeline_updates")
          .insert({
            employer_id: "employer-demo",
            candidate_user_id: null,
            application_id: null,
            candidate_name: candidateName,
            job_title: jobTitle,
            stage: stageLabel,
            stage_index: rejected ? -1 : stageIndex,
            note: note.trim(),
            updated_at: new Date().toISOString(),
          });
        if (sbError) throw sbError;
      }

      if (!rejected) setCurrentStageIndex(stageIndex);
      setIsRejected(rejected);
      setNote("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Pipeline update error:", err);
      setError("Could not save update. Check that the backend is running and Supabase tables exist.");
    } finally {
      setSaving(false);
    }
  };

  const activeStage = isRejected ? PIPELINE_REJECTED : stages[currentStageIndex];

  return (
    <section className="panel employer-section" style={{ marginTop: "1.5rem" }}>
      <div className="employer-section-head" style={{ marginBottom: "1.25rem" }}>
        <div>
          <p className="eyebrow">Hiring progress</p>
          <h2>Application Pipeline</h2>
          <p>Update the candidate&apos;s pipeline stage. They will see this in real-time on their tracker.</p>
        </div>
        {saved && (
          <span style={{
            fontSize: "0.78rem",
            color: "#10b981",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}>
            ✓ Update sent
          </span>
        )}
      </div>

      {/* Current status badge */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        marginBottom: "1.5rem",
        padding: "0.75rem 1rem",
        background: isRejected ? "rgba(239,68,68,0.06)" : "rgba(78,63,216,0.05)",
        borderRadius: "var(--r-s)",
        border: `1px solid ${isRejected ? "rgba(239,68,68,0.2)" : "rgba(78,63,216,0.15)"}`,
      }}>
        <span style={{ fontSize: "1.3rem" }}>{activeStage.icon}</span>
        <div>
          <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-40)", display: "block", fontFamily: "var(--font-space), monospace" }}>CURRENT STAGE</span>
          <span style={{ fontSize: "0.95rem", fontWeight: 700, color: isRejected ? "#ef4444" : "var(--ink)" }}>{activeStage.label}</span>
        </div>
      </div>

      {/* Visual pipeline stepper */}
      <div style={{ marginBottom: "1.5rem" }}>
        <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-40)", display: "block", marginBottom: "0.85rem", fontFamily: "var(--font-space), monospace" }}>
          PIPELINE STAGES — click to set
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.5rem" }}>
          {stages.map((stage, idx) => {
            const isComplete = !isRejected && idx < currentStageIndex;
            const isActive = !isRejected && idx === currentStageIndex;
            return (
              <button
                key={stage.label}
                onClick={() => handleSetStage(idx)}
                disabled={saving}
                style={{
                  padding: "0.6rem 0.5rem",
                  borderRadius: "var(--r-s)",
                  border: isActive
                    ? `2px solid ${stage.color}`
                    : isComplete
                      ? "2px solid rgba(16,185,129,0.4)"
                      : "1.5px solid var(--ink-12)",
                  background: isActive
                    ? `${stage.color}14`
                    : isComplete
                      ? "rgba(16,185,129,0.06)"
                      : "transparent",
                  cursor: saving ? "not-allowed" : "pointer",
                  textAlign: "center",
                  transition: "all 0.2s ease",
                  position: "relative",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {isComplete && (
                  <span style={{
                    position: "absolute",
                    top: "0.25rem",
                    right: "0.35rem",
                    fontSize: "0.6rem",
                    color: "#10b981",
                    fontWeight: 700,
                  }}>✓</span>
                )}
                <div style={{ fontSize: "1rem", marginBottom: "0.2rem" }}>{stage.icon}</div>
                <div style={{
                  fontSize: "0.6rem",
                  fontWeight: 600,
                  color: isActive ? stage.color : isComplete ? "#10b981" : "var(--ink-55)",
                  lineHeight: 1.2,
                }}>
                  {stage.label}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Note field */}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--ink-55)", display: "block", marginBottom: "0.35rem", fontFamily: "var(--font-space), monospace" }}>
          NOTE_FOR_CANDIDATE (Optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="E.g. 'Your interview is confirmed for Tuesday 3pm. We'll send a calendar invite shortly.'"
          style={{
            width: "100%",
            minHeight: "72px",
            padding: "0.65rem",
            fontSize: "0.8rem",
            fontFamily: "inherit",
            lineHeight: 1.5,
            color: "var(--ink)",
            border: "1px solid var(--ink-12)",
            borderRadius: "var(--r-s)",
            resize: "vertical",
            outline: "none",
            background: "rgba(26,29,41,0.005)",
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={handleAdvanceStage}
          disabled={saving || isRejected || currentStageIndex >= stages.length - 1}
          className="btn btn-primary"
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1.1rem",
            color: "#fff",
            opacity: (saving || isRejected || currentStageIndex >= stages.length - 1) ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : `Advance → ${currentStageIndex < stages.length - 1 ? stages[currentStageIndex + 1].label : "Final"}`}
        </button>

        <button
          onClick={handleReject}
          disabled={saving || isRejected}
          className="btn btn-ghost"
          style={{
            fontSize: "0.8rem",
            padding: "0.5rem 1rem",
            color: "#ef4444",
            borderColor: "rgba(239,68,68,0.3)",
            opacity: (saving || isRejected) ? 0.5 : 1,
          }}
        >
          Mark Rejected
        </button>
      </div>

      {error && (
        <p style={{ marginTop: "0.75rem", fontSize: "0.75rem", color: "#ef4444" }}>{error}</p>
      )}

      <style>{`
        .pipeline-stage-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
      `}</style>
    </section>
  );
}
