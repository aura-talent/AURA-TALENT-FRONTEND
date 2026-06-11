"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
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
  const [stage, setStage] = useState<Stage>("asking");
  const [error, setError] = useState<string | null>(null);

  const question = session.questions[session.currentIndex];
  const lastAnswer = session.answers[session.answers.length - 1];
  const answeredCurrent = session.answers.length > session.currentIndex;

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    setStage("asking");
    speak(question);
  }, [question, speak]);

  function startRecording() {
    recordStartRef.current = performance.now();
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

    // Start browser speech recognition in parallel to capture live transcript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SR) {
      liveTranscriptRef.current = "";
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e: any) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) {
            liveTranscriptRef.current += e.results[i][0].transcript + " ";
          }
        }
      };
      rec.start();
      recognitionRef.current = rec;
    }

    setStage("recording");
  }

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
        // In real mode Whisper gives the unfiltered transcript (including hesitations).
        // SpeechRecognition is browser-filtered so we only use it as a fallback in mock mode.
        if (evaluation.mocked) {
          const liveTranscript = liveTranscriptRef.current.trim();
          if (liveTranscript) evaluation.transcript = liveTranscript;
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
    [question, session.role, onEvaluated],
  );

  async function stopRecording() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const audio = await recorder.stop();
    const frames = vision.stop();
    const durationMs = performance.now() - recordStartRef.current;
    const telemetry =
      vision.status === "ready" ? aggregateTelemetry(frames, durationMs) : null;
    pendingRef.current = { audio, telemetry };
    await submit(audio, telemetry);
  }

  function advance() {
    if (session.currentIndex + 1 >= session.questions.length) onComplete();
    else onNext();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <Progress
          value={(session.currentIndex / session.questions.length) * 100}
          className="max-w-[60%]"
        />
        <HistorySheet answers={session.answers} />
      </div>

      <Card className="">
        <CardHeader>
          <CardTitle className="text-lg">
            Question {session.currentIndex + 1} of {session.questions.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 w-full">
          <p className="text-base">{question}</p>
          <div className="relative w-full max-w-2xl">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="aspect-video w-full rounded-md bg-black object-cover"
            />
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full rounded-md"
            />
          </div>
          {stage === "asking" && (
            <Button onClick={startRecording} disabled={speaking}>
              {speaking ? "Interviewer is speaking…" : "Start recording"}
            </Button>
          )}
          {stage === "recording" && (
            <Button variant="destructive" onClick={stopRecording}>
              Stop recording
            </Button>
          )}
          {stage === "evaluating" && (
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
              <p className="text-sm text-muted-foreground">Analyzing your answer…</p>
            </div>
          )}
          {stage === "error" && (
            <div className="space-y-2">
              <p className="text-sm text-red-500">{error}</p>
              <Button
                onClick={() =>
                  pendingRef.current &&
                  submit(pendingRef.current.audio, pendingRef.current.telemetry)
                }
              >
                Retry evaluation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {stage === "feedback" && answeredCurrent && lastAnswer && (
        <>
          <ScoreDashboard evaluation={lastAnswer.evaluation} />
          <Button onClick={advance}>
            {session.currentIndex + 1 >= session.questions.length
              ? "Finish & see report"
              : "Next question"}
          </Button>
        </>
      )}
    </main>
  );
}
