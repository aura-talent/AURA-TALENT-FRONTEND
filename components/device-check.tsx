"use client";
import { useEffect, useRef, useState } from "react";
import type { VisionStatus } from "@/hooks/use-vision";

interface Props {
  visionStatus: VisionStatus;
  loadVision: () => void;
  onReady: (stream: MediaStream) => void;
}

export default function DeviceCheck({ visionStatus, loadVision, onReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    loadVision();
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: true })
      .then((s) => {
        if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {
        setDeviceError(
          "Camera and microphone access is required. Allow access in your browser's site settings (the icon next to the address bar), then reload."
        );
      });
    return () => { active = false; };
  }, [loadVision]);

  const devicesReady = stream !== null;
  const visionDone = visionStatus === "ready" || visionStatus === "failed";
  const allReady = devicesReady && visionDone;

  const checks = [
    {
      id: "camera",
      label: "Camera & microphone",
      status: deviceError ? "error" : devicesReady ? "done" : "loading",
      note: deviceError ?? (devicesReady ? "Access granted" : "Requesting access…"),
    },
    {
      id: "vision",
      label: "Vision analysis",
      status: visionStatus === "ready" ? "done" : visionStatus === "failed" ? "warn" : "loading",
      note:
        visionStatus === "loading" ? "Loading models…"
          : visionStatus === "ready" ? "Facial analysis ready"
          : "Will run audio-only",
    },
  ] as const;

  return (
    <div style={{
      minHeight: "calc(100svh - 64px)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem 1.5rem",
    }}>
      <div style={{ width: "100%", maxWidth: 540, animation: "setup-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" }}>

        <div style={{ marginBottom: "2rem" }}>
          <span style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: "0.68rem", letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
          }}>
            Step 1 of 2 — Device setup
          </span>
          <h2 style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(1.5rem, 4vw, 2rem)",
            fontWeight: 800, letterSpacing: "-0.025em",
            color: "var(--ink)", marginTop: "0.4rem", lineHeight: 1.15,
          }}>
            Camera check
          </h2>
          <p style={{ color: "var(--ink-55)", fontSize: "0.9375rem", marginTop: "0.3rem" }}>
            Make sure you can see yourself clearly and your face is well lit.
          </p>
        </div>

        {deviceError ? (
          <div style={{
            padding: "1.25rem 1.5rem",
            border: "1.5px solid rgba(188, 74, 42, 0.25)",
            borderRadius: "var(--r-m)",
            background: "rgba(188, 74, 42, 0.04)",
          }}>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
              <span style={{ fontSize: "1.1rem", lineHeight: 1.4 }}>⚠️</span>
              <p style={{ fontSize: "0.875rem", color: "var(--ink)", lineHeight: 1.6 }}>{deviceError}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Camera feed */}
            <div style={{
              position: "relative",
              borderRadius: "var(--r-l)",
              overflow: "hidden",
              background: "#0d0d14",
              aspectRatio: "16/9",
              marginBottom: "1.5rem",
              boxShadow: "var(--shadow-lift)",
            }}>
              <video
                ref={videoRef}
                autoPlay muted playsInline
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
              {!devicesReady && (
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "#0d0d14",
                }}>
                  <CameraLoadingIndicator />
                </div>
              )}
            </div>

            {/* Checklist */}
            <div style={{
              display: "flex", flexDirection: "column", gap: "0.5rem",
              marginBottom: "1.5rem",
            }}>
              {checks.map(({ id, label, status, note }) => (
                <div key={id} style={{
                  display: "flex", alignItems: "center", gap: "0.85rem",
                  padding: "0.75rem 1rem",
                  border: "1px solid var(--ink-06)",
                  borderRadius: "var(--r-s)",
                  background: "var(--surface)",
                }}>
                  <StatusDot status={status} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--ink)" }}>{label}</div>
                    <div style={{ fontSize: "0.78rem", color: "var(--ink-55)", marginTop: "0.1rem" }}>{note}</div>
                  </div>
                </div>
              ))}
            </div>

            <button
              disabled={!allReady}
              onClick={() => stream && onReady(stream)}
              style={{
                width: "100%",
                padding: "0.95rem 2rem",
                background: allReady ? "var(--iris)" : "var(--ink-06)",
                color: allReady ? "#fff" : "var(--ink-30)",
                border: "none",
                borderRadius: "var(--r-pill)",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: allReady ? "pointer" : "not-allowed",
                transition: "all 0.25s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
              }}
            >
              {allReady ? (
                <><CheckIcon /> I&rsquo;m ready — start interview</>
              ) : (
                <><LoadingDots /> Preparing…</>
              )}
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes setup-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.4; }
          40% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes status-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function StatusDot({ status }: { status: "loading" | "done" | "warn" | "error" }) {
  if (status === "done") {
    return (
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(23,133,92,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--score-strong)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
    );
  }
  if (status === "warn") {
    return (
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(185,125,20,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-fair)" }}>!</span>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(188,74,42,0.1)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--score-weak)" }}>✕</span>
      </div>
    );
  }
  return (
    <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{
        width: 16, height: 16, borderRadius: "50%",
        border: "2px solid var(--ink-12)",
        borderTopColor: "var(--iris)",
        animation: "status-spin 0.8s linear infinite",
      }} />
    </div>
  );
}

function CameraLoadingIndicator() {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2px solid rgba(255,255,255,0.1)",
        borderTopColor: "rgba(255,255,255,0.6)",
        animation: "spin-slow 1s linear infinite",
        margin: "0 auto 0.75rem",
      }} />
      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.8rem", fontFamily: "var(--font-mono), monospace" }}>
        Requesting camera…
      </p>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LoadingDots() {
  return (
    <span style={{ display: "inline-flex", gap: 3, alignItems: "center", height: 12 }}>
      {[0, 1, 2].map((i) => (
        <span key={i} style={{
          width: 4, height: 4, borderRadius: "50%",
          background: "currentColor", display: "inline-block",
          animation: `dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </span>
  );
}
