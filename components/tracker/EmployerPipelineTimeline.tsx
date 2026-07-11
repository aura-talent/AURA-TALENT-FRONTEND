"use client";

import { useEffect, useState } from "react";
import { api, type PipelineStageUpdate, PIPELINE_STAGES, PIPELINE_REJECTED } from "@/lib/api";

export default function EmployerPipelineTimeline({ applicationId }: { applicationId: string }) {
  const [updates, setUpdates] = useState<PipelineStageUpdate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    api.getPipelineUpdates()
      .then(data => {
        if (!mounted) return;
        // Show updates that are explicitly linked to this application_id.
        // Fall back to unlinked updates (no application_id) only when this application has none.
        const linked = data.filter(u => (u as any).application_id === applicationId);
        const appUpdates = linked.length > 0
          ? linked
          : data.filter(u => !(u as any).application_id);
        // Sort newest first so the latest employer action shows at the top
        appUpdates.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        setUpdates(appUpdates);
      })
      .catch(err => console.error("Failed to load pipeline updates", err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => { mounted = false; };
  }, [applicationId]);

  if (loading) {
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "var(--font-space), monospace" }}>EMPLOYER_PIPELINE</h4>
        <div style={{ padding: "1rem", background: "rgba(26,29,41,0.02)", borderRadius: "var(--r-s)", fontSize: "0.75rem", color: "var(--ink-55)" }}>
          Loading pipeline status...
        </div>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div style={{ marginBottom: "1.5rem" }}>
        <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "var(--font-space), monospace" }}>EMPLOYER_PIPELINE</h4>
        <div style={{ padding: "1rem", background: "rgba(26,29,41,0.015)", border: "1px dashed var(--ink-12)", borderRadius: "var(--r-s)", fontSize: "0.75rem", color: "var(--ink-40)", textAlign: "center" }}>
          Your application timeline will appear here once the employer updates it.
        </div>
      </div>
    );
  }

  // The latest update determines the current stage
  const latestUpdate = updates[0];
  const isRejected = latestUpdate.stage_index === -1 || latestUpdate.stage === "Rejected";
  const currentStageIndex = isRejected ? -1 : latestUpdate.stage_index;
  const activeStage = isRejected ? PIPELINE_REJECTED : PIPELINE_STAGES[currentStageIndex];

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <h4 style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.75rem", fontFamily: "var(--font-space), monospace" }}>EMPLOYER_PIPELINE</h4>
      
      <div style={{ 
        padding: "1.25rem", 
        background: isRejected ? "rgba(239,68,68,0.03)" : "rgba(78,63,216,0.03)", 
        border: `1px solid ${isRejected ? "rgba(239,68,68,0.15)" : "rgba(78,63,216,0.15)"}`,
        borderRadius: "var(--r-s)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.25rem" }}>
          <span style={{ fontSize: "1.5rem" }}>{activeStage.icon}</span>
          <div>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--ink-40)", display: "block", fontFamily: "var(--font-space), monospace" }}>CURRENT STAGE</span>
            <span style={{ fontSize: "1.05rem", fontWeight: 700, color: isRejected ? "#ef4444" : "var(--ink)" }}>{activeStage.label}</span>
          </div>
        </div>

        {/* Vertical timeline feed of employer notes */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", borderLeft: "2px solid var(--ink-12)", paddingLeft: "1rem", marginLeft: "0.5rem" }}>
          {updates.map((update) => {
            const isRej = update.stage_index === -1 || update.stage === "Rejected";
            const stageDef = isRej ? PIPELINE_REJECTED : PIPELINE_STAGES[update.stage_index];
            const date = new Date(update.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
            
            return (
              <div key={update.id} style={{ position: "relative" }}>
                <span style={{ 
                  position: "absolute", 
                  left: "-1.35rem", 
                  top: "0.25rem", 
                  width: "8px", 
                  height: "8px", 
                  borderRadius: "50%", 
                  background: isRej ? "#ef4444" : (stageDef ? stageDef.color : "var(--ink-55)"),
                  border: "2px solid var(--surface)"
                }} />
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: update.note ? "0.25rem" : 0 }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ink)" }}>
                    {update.stage}
                  </span>
                  <span className="mono" style={{ fontSize: "0.65rem", color: "var(--ink-40)" }}>
                    {date}
                  </span>
                </div>
                
                {update.note && (
                  <div style={{ 
                    fontSize: "0.72rem", 
                    color: "var(--ink-65)", 
                    margin: 0, 
                    lineHeight: 1.4,
                    background: "rgba(26,29,41,0.02)",
                    padding: "0.5rem 0.6rem",
                    borderRadius: "4px",
                    borderLeft: `2px solid ${isRej ? "#ef4444" : (stageDef ? stageDef.color : "var(--ink-20)")}`
                  }}>
                    {update.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}