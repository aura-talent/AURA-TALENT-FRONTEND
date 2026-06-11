"use client";
import { useCallback, useState } from "react";
import SetupScreen from "@/components/setup-screen";
import DeviceCheck from "@/components/device-check";
import InterviewStage from "@/components/interview-stage";
import FinalReport from "@/components/final-report";
import { useSession, type Answer } from "@/hooks/use-session";
import { useVision } from "@/hooks/use-vision";

export default function Home() {
  const [session, dispatch] = useSession();
  const vision = useVision();
  const [stream, setStream] = useState<MediaStream | null>(null);

  const handleStart = useCallback(
    (role: string, questions: string[], mocked: boolean) =>
      dispatch({ type: "START_SESSION", role, questions, mocked }),
    [dispatch],
  );

  const handleReady = useCallback(
    (s: MediaStream) => {
      setStream(s);
      dispatch({ type: "DEVICES_READY" });
    },
    [dispatch],
  );

  const handleEvaluated = useCallback(
    (answer: Answer) => dispatch({ type: "ANSWER_EVALUATED", answer }),
    [dispatch],
  );

  const handleRestart = useCallback(() => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    dispatch({ type: "RESET" });
  }, [dispatch, stream]);

  switch (session.phase) {
    case "setup":
      return <SetupScreen onStart={handleStart} />;
    case "check":
      return (
        <DeviceCheck
          visionStatus={vision.status}
          loadVision={vision.load}
          onReady={handleReady}
        />
      );
    case "interview":
      if (!stream) return null;
      return (
        <InterviewStage
          session={session}
          vision={vision}
          stream={stream}
          onEvaluated={handleEvaluated}
          onNext={() => dispatch({ type: "NEXT_QUESTION" })}
          onComplete={() => {
            stream.getTracks().forEach((t) => t.stop());
            dispatch({ type: "SESSION_COMPLETE" });
          }}
        />
      );
    case "report":
      return (
        <FinalReport
          role={session.role}
          answers={session.answers}
          onRestart={handleRestart}
        />
      );
  }
}
