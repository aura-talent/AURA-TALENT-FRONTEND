"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ScoreDashboard from "@/components/score-dashboard";
import HistorySheet from "@/components/history-sheet";
import { useSpeech } from "@/hooks/use-speech";
import { useRecorder } from "@/hooks/use-recorder";
import { aggregateTelemetry } from "@/lib/telemetry";
import { EvaluationSchema, type Telemetry } from "@/lib/schemas";
import type { Answer, SessionState } from "@/hooks/use-session";
import type { useVision } from "@/hooks/use-vision";

type Stage = "asking" | "recording" | "evaluating" | "feedback" | "error";

interface Props {
  session: SessionState;
  vision: ReturnType<typeof useVision>;
  stream: MediaStream;
  onEvaluated: (answer: Answer) => void;
  onNext: () => void;
  onComplete: () => void;
}

export default function InterviewStage({
  session, vision, stream, onEvaluated, onNext, onComplete,
}: Props) {
  const { speak, speaking } = useSpeech();
  const recorder = useRecorder(stream);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordStartRef = useRef(0);
  const pendingRef = useRef<{ audio: Blob; telemetry: Telemetry | null } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const liveTranscriptRef = useRef<string>("");
  const srActiveRef = useRef(false);
  const [stage, setStage] = useState<Stage>("asking");
  const [error, setError] = useState<string | null>(null);

  const question = session.questions[session.currentIndex];
  const lastAnswer = session.answers[session.answers.length - 1];
  const answeredCurrent = session.answers.length > session.currentIndex;
  const isLast = session.currentIndex + 1 >= session.questions.length;
  const progressPct = (session.currentIndex / session.questions.length) * 100;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStage("asking");
    speak(question);
  }, [question, speak]);

  function startRecording() {
    recordStartRef.current = performance.now();

    setStage("recording");

    // reset transcript state
    liveTranscriptRef.current = "";
    srActiveRef.current = false;

    const SR =
      (window as any).SpeechRecognition ??
      (window as any).webkitSpeechRecognition;

    /**
     * IMPORTANT (Arc fix):
     * Create a dedicated mic stream for SpeechRecognition FIRST
     * so MediaRecorder does not "lock" the device.
     */
    if (SR) {
      try {
        srActiveRef.current = true;

        const rec = new SR();
        rec.continuous = true;
        rec.interimResults = false;

        rec.onresult = (e: any) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) {
              liveTranscriptRef.current +=
                e.results[i][0].transcript + " ";
            }
          }
        };

        rec.onerror = () => {
          srActiveRef.current = false;
        };

        recognitionRef.current = rec;
        rec.start();
      } catch (e) {
        console.warn("SpeechRecognition failed:", e);
        srActiveRef.current = false;
      }
    }

    /**
     * THEN start recorder + vision AFTER SR
     * (Arc fix: prevents mic starvation)
     */
    recorder.start();

    if (vision.status === "ready" && videoRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (canvas) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
      }

      vision.start(video, canvas);
    }
  }

  // function startRecording() {
  //   recordStartRef.current = performance.now();
  //   recorder.start();
  //   if (vision.status === "ready" && videoRef.current) {
  //     const video = videoRef.current;
  //     const canvas = canvasRef.current;
  //     if (canvas) {
  //       canvas.width = video.videoWidth || 640;
  //       canvas.height = video.videoHeight || 480;
  //     }
  //     vision.start(video, canvas);
  //   }

  //   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //   const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  //   liveTranscriptRef.current = "";
  //   srActiveRef.current = false;
  //   if (SR) {
  //     srActiveRef.current = true;
  //     const rec = new SR();
  //     rec.continuous = true;
  //     rec.interimResults = false;
  //     // eslint-disable-next-line @typescript-eslint/no-explicit-any
  //     rec.onresult = (e: any) => {
  //       for (let i = e.resultIndex; i < e.results.length; i++) {
  //         if (e.results[i].isFinal) {
  //           liveTranscriptRef.current += e.results[i][0].transcript + " ";
  //         }
  //       }
  //     };
  //     rec.start();
  //     recognitionRef.current = rec;
  //   }
  //   setStage("recording");
  // }

  const zeroEvaluation = useCallback((telemetry: Telemetry | null): Answer => ({
    question,
    telemetry,
    evaluation: {
      transcript: "",
      scores: { contentRelevance: 0, clarityStructure: 0, confidenceDelivery: 0, bodyLanguage: 0 },
      overallScore: 0,
      strengths: ["—"],
      improvements: ["No response was recorded — make sure your microphone is on and speak clearly."],
      summary: "No answer was detected for this question.",
      mocked: false,
    },
  }), [question]);

  const submit = useCallback(
    async (audio: Blob, telemetry: Telemetry | null) => {
      setStage("evaluating");
      setError(null);
      try {
        const fd = new FormData();
        fd.append("audio", audio, "answer.webm");
        fd.append("telemetry", JSON.stringify(telemetry));
        fd.append("question", question);
        fd.append("role", session.role);
        const res = await fetch("/api/evaluate", { method: "POST", body: fd });
        if (!res.ok) throw new Error(`Evaluation failed (${res.status})`);
        const evaluation = EvaluationSchema.parse(await res.json());
        if (evaluation.mocked) {
          const liveTranscript = liveTranscriptRef.current.trim();
          if (liveTranscript) evaluation.transcript = liveTranscript;
        }
        // Safety net: if API still returns empty transcript, treat as no answer
        if (!evaluation.transcript.trim()) {
          pendingRef.current = null;
          onEvaluated(zeroEvaluation(telemetry));
          setStage("feedback");
          return;
        }
        console.log("You said:", evaluation.transcript);
        pendingRef.current = null;
        onEvaluated({ question, evaluation, telemetry });
        setStage("feedback");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Evaluation failed");
        setStage("error");
      }
    },
    [question, session.role, onEvaluated, zeroEvaluation],
  );

  // async function stopRecording() {
  //   console.log('pressed stop button');
  //   // Wait for SR to flush all final onresult events before reading the transcript.
  //   // SR delivers results asynchronously after stop(), so we must await onend.
  //   await new Promise<void>((resolve) => {
  //     if (recognitionRef.current) {
  //       recognitionRef.current.onend = () => resolve();
  //       recognitionRef.current.stop();
  //     } else {
  //       resolve();
  //     }
  //   });
  //   recognitionRef.current = null;

  //   const audio = await recorder.stop();
  //   const frames = vision.stop();
  //   const durationMs = performance.now() - recordStartRef.current;
  //   const telemetry = vision.status === "ready" ? aggregateTelemetry(frames, durationMs) : null;

  //   // Skip API entirely if SR was active but caught nothing (user said nothing)
  //   if (srActiveRef.current && liveTranscriptRef.current.trim() === "") {
  //     onEvaluated(zeroEvaluation(telemetry));
  //     setStage("feedback");
  //     return;
  //   }

  //   pendingRef.current = { audio, telemetry };
  //   await submit(audio, telemetry);
  // }

  async function stopRecording() {
    console.log("pressed stop button");

    const rec = recognitionRef.current;

    // Stop SpeechRecognition safely (Arc-proof)
    await new Promise<void>((resolve) => {
      if (!rec) return resolve();

      let done = false;

      const cleanup = () => {
        if (done) return;
        done = true;

        try {
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
        } catch { }

        resolve();
      };

      // Attach FIRST (Arc timing fix)
      rec.onend = cleanup;
      rec.onerror = cleanup;

      try {
        rec.stop();
      } catch {
        cleanup();
      }

      // HARD fallback (Arc often never fires onend)
      setTimeout(cleanup, 500);
    });

    recognitionRef.current = null;

    // Stop recorder + vision
    const audio = await recorder.stop();
    const frames = vision.stop();

    const durationMs = performance.now() - recordStartRef.current;

    const telemetry =
      vision.status === "ready"
        ? aggregateTelemetry(frames, durationMs)
        : null;

    /**
     * Arc safety net:
     * If SR captured nothing, fallback immediately
     */
    if (srActiveRef.current && !liveTranscriptRef.current.trim()) {
      onEvaluated(zeroEvaluation(telemetry));
      setStage("feedback");
      return;
    }

    pendingRef.current = { audio, telemetry };

    await submit(audio, telemetry);
  }

  function advance() {
    if (isLast) onComplete();
    else onNext();
  }

  return (
    <div style={{ minHeight: "calc(100svh - 64px)", background: "var(--porcelain)", backgroundImage: `linear-gradient(rgba(26, 29, 41, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(26, 29, 41, 0.035) 1px, transparent 1px)`, backgroundSize: "44px 44px", }}>
      {/* Top progress rail */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 2, background: "var(--ink-06)", zIndex: 100 }}>
        <div style={{
          height: "100%",
          background: "var(--iris)",
          width: `${progressPct}%`,
          transition: "width 0.7s cubic-bezier(0.4, 0, 0.2, 1)",
        }} />
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem 5rem" }}>

        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{
              fontFamily: "var(--font-space), monospace",
              fontSize: "0.68rem", letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--ink-55)", fontWeight: 600,
            }}>
              {session.currentIndex + 1} / {session.questions.length}
            </span>
            <StagePill stage={stage} speaking={speaking} />
          </div>
          <HistorySheet answers={session.answers} />
        </div>

        {/* Question block */}
        <div style={{ position: "relative", marginBottom: "2rem" }}>
          <span aria-hidden style={{
            position: "absolute",
            top: "-1rem", left: "-0.5rem",
            fontFamily: "var(--font-space), monospace",
            fontSize: "clamp(4rem, 11vw, 6.5rem)",
            fontWeight: 700,
            color: "var(--ink-06)",
            lineHeight: 1,
            userSelect: "none",
            letterSpacing: "-0.04em",
            pointerEvents: "none",
          }}>
            {String(session.currentIndex + 1).padStart(2, "0")}
          </span>
          <p style={{
            fontFamily: "var(--font-display), sans-serif",
            fontSize: "clamp(1.15rem, 2.8vw, 1.5rem)",
            fontWeight: 700,
            lineHeight: 1.35,
            letterSpacing: "-0.015em",
            color: "var(--ink)",
            paddingTop: "clamp(2rem, 4vw, 3rem)",
            position: "relative",
          }}>
            {question}
          </p>
        </div>

        {/* Camera zone */}
        <div style={{ position: "relative", marginBottom: "1.5rem" }}>
          <div style={{
            position: "relative",
            borderRadius: 0,
            overflow: "hidden",
            background: "#0a0a12",
            aspectRatio: "16/9",
            border: "1px solid var(--ink)",
            boxShadow: stage === "recording"
              ? "0 0 0 2px var(--score-weak)"
              : "none",
            transition: "box-shadow 0.3s ease",
          }}>
            <video
              ref={videoRef}
              autoPlay muted playsInline
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            <canvas
              ref={canvasRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
            />

            {/* Recording badge overlay */}
            {stage === "recording" && (
              <div style={{
                position: "absolute", top: "1rem", right: "1rem",
                display: "flex", alignItems: "center", gap: "0.4rem",
                background: "rgba(188, 74, 42, 0.9)",
                borderRadius: 0,
                padding: "0.3rem 0.75rem",
                backdropFilter: "blur(8px)",
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "#fff",
                  animation: "rec-pulse 0.9s ease-in-out infinite",
                }} />
                <span style={{
                  fontFamily: "var(--font-space), monospace",
                  fontSize: "0.65rem", letterSpacing: "0.12em",
                  color: "#fff", fontWeight: 700, textTransform: "uppercase",
                }}>REC</span>
              </div>
            )}

            {/* Speaking overlay */}
            {speaking && stage === "asking" && (
              <div style={{
                position: "absolute", bottom: "1rem",
                left: "50%", transform: "translateX(-50%)",
                background: "rgba(78, 63, 216, 0.88)",
                borderRadius: 0,
                padding: "0.4rem 1.1rem",
                backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", gap: "0.55rem",
                whiteSpace: "nowrap",
              }}>
                <AudioWave />
                <span style={{ color: "#fff", fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.01em" }}>
                  Interviewer speaking
                </span>
              </div>
            )}

            {/* Evaluating overlay */}
            {stage === "evaluating" && (
              <div style={{
                position: "absolute", inset: 0,
                background: "rgba(10, 10, 18, 0.75)",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: "1rem",
                backdropFilter: "blur(6px)",
              }}>
                <DualRingSpinner />
                <p style={{ color: "rgba(255,255,255,0.65)", fontSize: "0.85rem", fontWeight: 500 }}>
                  Analyzing your answer…
                </p>
              </div>
            )}
          </div>

          {/* Corner brackets when recording */}
          {stage === "recording" && (
            <>
              {(["tl", "tr", "bl", "br"] as const).map((pos) => (
                <CornerBracket key={pos} pos={pos} />
              ))}
            </>
          )}
        </div>

        {/* Action zone */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          {stage === "asking" && (
            <button
              onClick={startRecording}
              disabled={speaking}
              style={{
                width: "100%",
                maxWidth: 380,
                padding: "1rem 2rem",
                background: speaking ? "var(--ink-06)" : "var(--iris)",
                color: speaking ? "var(--ink-30)" : "#fff",
                border: "none",
                borderRadius: 0,
                fontFamily: "var(--font-space), monospace",
                fontSize: "0.75rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: speaking ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "0.5rem",
                transition: "all 0.2s ease",
              }}
            >
              {speaking ? (
                <>
                  <AudioWaveDark />
                  Wait for the question…
                </>
              ) : (
                <>
                  <MicIcon />
                  Start answering
                </>
              )}
            </button>
          )}

          {stage === "recording" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5rem" }}>
              <button
                onClick={stopRecording}
                style={{
                  width: 68, height: 68, borderRadius: "50%",
                  background: "var(--score-weak)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  animation: "record-pulse 2s ease-in-out infinite",
                  boxShadow: "0 0 0 0 rgba(188, 74, 42, 0.5)",
                }}
                title="Stop recording"
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, background: "#fff" }} />
              </button>
              <span style={{
                fontFamily: "var(--font-space), monospace",
                fontSize: "0.68rem", color: "var(--ink-55)",
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Tap to stop
              </span>
            </div>
          )}

          {stage === "error" && (
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <p style={{ color: "var(--score-weak)", fontSize: "0.875rem", marginBottom: "1rem", lineHeight: 1.5 }}>
                {error}
              </p>
              <button
                onClick={() => pendingRef.current && submit(pendingRef.current.audio, pendingRef.current.telemetry)}
                style={{
                  padding: "0.75rem 1.75rem",
                  background: "var(--iris)",
                  color: "#fff", border: "none",
                  borderRadius: 0,
                  fontFamily: "var(--font-space), monospace",
                  fontWeight: 700, cursor: "pointer",
                  fontSize: "0.75rem", letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                Retry evaluation
              </button>
            </div>
          )}
        </div>

        {/* Feedback panel */}
        {stage === "feedback" && answeredCurrent && lastAnswer && (
          <div style={{ marginTop: "2.5rem", animation: "feedback-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" }}>
            <ScoreDashboard evaluation={lastAnswer.evaluation} />
            <button
              onClick={advance}
              style={{
                width: "100%",
                marginTop: "1.25rem",
                padding: "1rem 2rem",
                background: "var(--ink)",
                color: "var(--porcelain)",
                border: "none",
                borderRadius: 0,
                fontFamily: "var(--font-space), monospace",
                fontSize: "0.75rem", fontWeight: 700,
                letterSpacing: "0.08em", textTransform: "uppercase",
                cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "0.5rem",
                transition: "opacity 0.15s ease",
              }}
            >
              {isLast ? "View final report →" : "Next question →"}
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes rec-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.35; transform: scale(0.75); }
        }
        @keyframes record-pulse {
          0% { box-shadow: 0 0 0 0 rgba(188, 74, 42, 0.5); }
          70% { box-shadow: 0 0 0 18px rgba(188, 74, 42, 0); }
          100% { box-shadow: 0 0 0 0 rgba(188, 74, 42, 0); }
        }
        @keyframes feedback-in {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin-a { to { transform: rotate(360deg); } }
        @keyframes spin-b { to { transform: rotate(-360deg); } }
        @keyframes wave-bar {
          0%, 100% { transform: scaleY(0.35); }
          50% { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}

function StagePill({ stage, speaking }: { stage: Stage; speaking: boolean }) {
  type PillKey = Stage | "speaking";
  const configs: Record<PillKey, { label: string; color: string; bg: string; pulse?: boolean }> = {
    speaking: { label: "Speaking", color: "#fff", bg: "var(--iris)", pulse: false },
    asking: { label: "Your turn", color: "var(--score-strong)", bg: "rgba(23,133,92,0.1)" },
    recording: { label: "Recording", color: "var(--score-weak)", bg: "rgba(188,74,42,0.1)", pulse: true },
    evaluating: { label: "Analyzing", color: "var(--iris-deep)", bg: "var(--iris-08)" },
    feedback: { label: "Feedback ready", color: "var(--score-strong)", bg: "rgba(23,133,92,0.1)" },
    error: { label: "Error", color: "var(--score-weak)", bg: "rgba(188,74,42,0.1)" },
  };
  const key: PillKey = speaking ? "speaking" : stage;
  const c = configs[key];
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: "0.35rem",
      background: c.bg, color: c.color,
      border: "1px solid currentColor",
      padding: "0.25rem 0.65rem",
      borderRadius: 0,
      fontSize: "0.65rem", fontWeight: 700,
      fontFamily: "var(--font-space), monospace",
      letterSpacing: "0.1em", textTransform: "uppercase",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: "currentColor",
        ...(c.pulse ? { animation: "rec-pulse 0.9s ease-in-out infinite" } : {}),
      }} />
      {c.label}
    </div>
  );
}

function CornerBracket({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const base: React.CSSProperties = {
    position: "absolute", width: 18, height: 18, zIndex: 10,
    animation: "feedback-in 0.25s ease both",
  };
  const borders: Record<typeof pos, React.CSSProperties> = {
    tl: { top: -3, left: -3, borderTop: "2px solid var(--score-weak)", borderLeft: "2px solid var(--score-weak)" },
    tr: { top: -3, right: -3, borderTop: "2px solid var(--score-weak)", borderRight: "2px solid var(--score-weak)" },
    bl: { bottom: -3, left: -3, borderBottom: "2px solid var(--score-weak)", borderLeft: "2px solid var(--score-weak)" },
    br: { bottom: -3, right: -3, borderBottom: "2px solid var(--score-weak)", borderRight: "2px solid var(--score-weak)" },
  };
  return <div style={{ ...base, ...borders[pos] }} />;
}

function AudioWave() {
  return (
    <div style={{ display: "flex", gap: 2.5, alignItems: "center", height: 14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          width: 2.5, height: 10, borderRadius: 2, background: "rgba(255,255,255,0.85)",
          animation: `wave-bar 0.9s ease-in-out ${i * 0.12}s infinite`,
        }} />
      ))}
    </div>
  );
}

function AudioWaveDark() {
  return (
    <div style={{ display: "flex", gap: 2.5, alignItems: "center", height: 14 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} style={{
          width: 2.5, height: 10, borderRadius: 2, background: "rgba(26,29,41,0.35)",
          animation: `wave-bar 0.9s ease-in-out ${i * 0.12}s infinite`,
        }} />
      ))}
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  );
}

function DualRingSpinner() {
  return (
    <div style={{ position: "relative", width: 48, height: 48 }}>
      <div style={{
        position: "absolute", inset: 0,
        border: "2.5px solid transparent",
        borderTopColor: "var(--aura-a)",
        borderRightColor: "var(--aura-b)",
        borderRadius: "50%",
        animation: "spin-a 1.1s linear infinite",
      }} />
      <div style={{
        position: "absolute", inset: 8,
        border: "2px solid transparent",
        borderTopColor: "var(--iris)",
        borderRadius: "50%",
        animation: "spin-b 0.75s linear infinite",
      }} />
    </div>
  );
}
