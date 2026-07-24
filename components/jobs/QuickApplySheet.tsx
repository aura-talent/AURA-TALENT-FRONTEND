"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export interface QuickApplyJob {
  id: string;
  title: string;
  company: string;
  team: string;
  fit: number;
  location: string;
  employmentType: string;
  salary: string;
}

interface QuickApplySheetProps {
  job: QuickApplyJob | null;
  onClose: () => void;
}

export default function QuickApplySheet({ job, onClose }: QuickApplySheetProps) {
  const [status, setStatus] = useState<"idle" | "applying" | "done" | "error">("idle");
  const [startY, setStartY] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const open = job !== null;

  // Reset state when sheet opens for a new job
  useEffect(() => {
    if (open) {
      setStatus("idle");
      setDragY(0);
    }
  }, [job?.id, open]);

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function handleApply() {
    setStatus("applying");
    // Simulate a quick apply — creates tracker entry
    setTimeout(() => setStatus("done"), 1100);
  }

  // Touch drag-to-dismiss
  function onTouchStart(e: React.TouchEvent) {
    setStartY(e.touches[0].clientY);
    setDragY(0);
  }
  function onTouchMove(e: React.TouchEvent) {
    if (startY === null) return;
    const delta = e.touches[0].clientY - startY;
    if (delta > 0) setDragY(delta);
  }
  function onTouchEnd() {
    if (dragY > 85) onClose();
    setDragY(0);
    setStartY(null);
  }

  if (!open) return null;

  const fitCategory =
    job!.fit >= 90 ? "EXCELLENT MATCH" : job!.fit >= 80 ? "STRONG MATCH" : "FAIR MATCH";
  const fitColor =
    job!.fit >= 90 ? "#bfead8" : job!.fit >= 80 ? "#c7b9ff" : "#ffd9c2";

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(7, 9, 20, 0.78)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "qa-backdrop-in 0.25s ease-out",
        }}
        aria-hidden="true"
      />

      {/* Sheet Modal */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Quick apply to ${job!.title}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 91,
          background: "linear-gradient(180deg, #121633 0%, #0b0e1c 100%)",
          borderTop: "1px solid rgba(199, 185, 255, 0.28)",
          borderRadius: "24px 24px 0 0",
          padding: "0 0 calc(env(safe-area-inset-bottom, 20px) + 8px)",
          boxShadow:
            "0 -12px 48px rgba(0, 0, 0, 0.65), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
          transform: `translateY(${dragY}px)`,
          transition: dragY === 0 ? "transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
          animation: dragY === 0 ? "qa-sheet-slide 0.35s cubic-bezier(0.16, 1, 0.3, 1)" : undefined,
          maxHeight: "92dvh",
          overflowY: "auto",
          color: "#fafaf8",
        }}
      >
        <style>{`
          @keyframes qa-backdrop-in { from { opacity: 0 } to { opacity: 1 } }
          @keyframes qa-sheet-slide { from { transform: translateY(100%) } to { transform: translateY(0) } }
          @keyframes qa-glow-pulse { 0%, 100% { opacity: 0.8; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }
          @keyframes qa-spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes qa-pop-in { 0% { transform: scale(0.8); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

          .qa-sheet-btn-primary {
            background: linear-gradient(135deg, #c7b9ff 0%, #8f7dff 50%, #6852ed 100%);
            box-shadow: 0 4px 20px rgba(143, 125, 255, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .qa-sheet-btn-primary:active {
            transform: scale(0.98);
            box-shadow: 0 2px 10px rgba(143, 125, 255, 0.3);
          }
          .qa-sheet-btn-secondary {
            background: rgba(250, 250, 248, 0.04);
            border: 1px solid rgba(250, 250, 248, 0.14);
            color: rgba(250, 250, 248, 0.78);
            transition: all 0.2s ease;
          }
          .qa-sheet-btn-secondary:active {
            background: rgba(250, 250, 248, 0.09);
            border-color: rgba(199, 185, 255, 0.4);
            color: #fafaf8;
          }
        `}</style>

        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "14px 0 6px" }}>
          <div
            style={{
              width: 42,
              height: 4.5,
              borderRadius: 99,
              background: "rgba(250, 250, 248, 0.25)",
              boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          />
        </div>

        <div style={{ padding: "12px 22px 22px" }}>
          {/* Kicker tag */}
          <div
            className="mono"
            style={{
              fontSize: "0.68rem",
              letterSpacing: "0.14em",
              color: "#c7b9ff",
              textTransform: "uppercase",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#c7b9ff", boxShadow: "0 0 8px #c7b9ff" }} />
            QUICK_INTAKE // 1-TAP APPLY
          </div>

          {/* Job header card */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 14,
              marginBottom: 18,
              padding: "14px 16px",
              background: "rgba(20, 25, 54, 0.6)",
              border: "1px solid rgba(250, 250, 248, 0.08)",
              borderRadius: 16,
              backdropFilter: "blur(10px)",
            }}
          >
            {/* Company Avatar with aura ring */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                flexShrink: 0,
                background: "linear-gradient(135deg, rgba(199,185,255,0.2), rgba(143,125,255,0.4))",
                border: "1.5px solid rgba(199,185,255,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 20,
                fontWeight: 800,
                color: "#ffffff",
                boxShadow: "0 4px 16px rgba(143,125,255,0.25)",
              }}
            >
              {job!.company[0]}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2
                style={{
                  fontWeight: 700,
                  fontSize: "1.08rem",
                  lineHeight: 1.25,
                  margin: "0 0 3px",
                  color: "#fafaf8",
                  letterSpacing: "-0.01em",
                }}
              >
                {job!.title}
              </h2>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "rgba(250, 250, 248, 0.6)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontWeight: 600, color: "rgba(250, 250, 248, 0.88)" }}>
                  {job!.company}
                </span>
                <span>•</span>
                <span>{job!.team}</span>
              </div>
            </div>

            {/* Fit Badge */}
            <div
              style={{
                flexShrink: 0,
                textAlign: "center",
                background: "linear-gradient(135deg, rgba(199,185,255,0.18), rgba(78,63,216,0.18))",
                border: `1.5px solid ${fitColor}55`,
                borderRadius: 12,
                padding: "6px 12px",
                boxShadow: `0 0 16px ${fitColor}22`,
              }}
            >
              <div
                style={{
                  fontSize: "1.15rem",
                  fontWeight: 800,
                  color: fitColor,
                  lineHeight: 1,
                  fontFamily: "var(--font-mono), monospace",
                }}
              >
                {job!.fit}%
              </div>
              <div
                style={{
                  fontSize: "0.58rem",
                  color: "rgba(250,250,248,0.55)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                match
              </div>
            </div>
          </div>

          {/* Meta tags */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
            {[job!.location, job!.employmentType, job!.salary].map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.74rem",
                  padding: "5px 12px",
                  borderRadius: 99,
                  background: "rgba(250, 250, 248, 0.05)",
                  border: "1px solid rgba(250, 250, 248, 0.12)",
                  color: "rgba(250, 250, 248, 0.72)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Pre-flight Checklist Card */}
          {status !== "done" && (
            <div
              style={{
                background: "rgba(14, 18, 42, 0.75)",
                border: "1px solid rgba(199, 185, 255, 0.18)",
                borderRadius: 16,
                padding: "14px 16px",
                marginBottom: 22,
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: "0.68rem",
                  letterSpacing: "0.1em",
                  color: "rgba(250,250,248,0.45)",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}
              >
                AURA_PREFLIGHT_VERIFICATION
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.82rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: "#bfead8", fontWeight: 700 }}>✓ Verified Resume</span>
                  <span style={{ color: "rgba(250,250,248,0.5)", fontSize: "0.76rem" }}>Attached from profile</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: fitColor, fontWeight: 700 }}>✓ {fitCategory}</span>
                  <span style={{ color: "rgba(250,250,248,0.5)", fontSize: "0.76rem" }}>{job!.fit}/100 Score</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ color: "rgba(250,250,248,0.9)", fontWeight: 500 }}>✓ Direct Employer Delivery</span>
                  <span style={{ color: "rgba(250,250,248,0.5)", fontSize: "0.76rem" }}>Northstar Labs</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Area */}
          {status === "done" ? (
            <div
              style={{
                textAlign: "center",
                padding: "24px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                alignItems: "center",
                background: "rgba(191, 234, 216, 0.06)",
                border: "1px solid rgba(191, 234, 216, 0.3)",
                borderRadius: 20,
                animation: "qa-pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(191,234,216,0.3) 0%, rgba(191,234,216,0) 70%)",
                  border: "2px solid #bfead8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: "#bfead8",
                  boxShadow: "0 0 24px rgba(191,234,216,0.4)",
                }}
              >
                ✓
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#bfead8", marginBottom: 4 }}>
                  Application Submitted!
                </div>
                <div style={{ fontSize: "0.84rem", color: "rgba(250, 250, 248, 0.6)", maxWidth: "28ch", margin: "0 auto" }}>
                  Your profile and resume have been sent directly to {job!.company}. Added to your tracker.
                </div>
              </div>
              <button
                onClick={onClose}
                className="qa-sheet-btn-secondary"
                style={{
                  marginTop: 10,
                  padding: "12px 32px",
                  borderRadius: 99,
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                }}
              >
                Done & Return
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <button
                onClick={handleApply}
                disabled={status === "applying"}
                className="qa-sheet-btn-primary"
                style={{
                  width: "100%",
                  padding: "15px 22px",
                  borderRadius: 14,
                  border: "none",
                  cursor: status === "applying" ? "wait" : "pointer",
                  color: "#0b0e1c",
                  fontWeight: 800,
                  fontSize: "0.98rem",
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {status === "applying" ? (
                  <>
                    <span style={{ animation: "qa-glow-pulse 0.8s ease infinite", fontSize: 18 }}>✦</span>
                    Submitting Application…
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 16 }}>⚡</span> 1-Tap Quick Apply Now
                  </>
                )}
              </button>

              <Link
                href={`/jobs/${job!.id}`}
                className="qa-sheet-btn-secondary"
                style={{
                  width: "100%",
                  padding: "13px 20px",
                  borderRadius: 14,
                  textAlign: "center",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "block",
                }}
              >
                View full job details →
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
