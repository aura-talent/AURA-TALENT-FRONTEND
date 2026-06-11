"use client";

import Thinking from "@/components/Thinking";
import type { ProgressEvent } from "@/lib/useStream";

interface StreamProgressProps {
  title?: string;
  progress: ProgressEvent[];
  fallbackLines: string[];
}

export default function StreamProgress({
  title = "Aura is working",
  progress,
  fallbackLines,
}: StreamProgressProps) {
  const latest = progress.at(-1);

  if (progress.length === 0) {
    return <Thinking lines={fallbackLines} />;
  }

  return (
    <div className="stream-progress" role="status" aria-live="polite">
      <div className="thinking-orb" aria-hidden="true" />
      <div className="stream-progress-copy">
        <p className="stream-progress-kicker">{title}</p>
        <p className="stream-progress-current">{latest?.message}</p>
      </div>
      <ol className="stream-steps" aria-label="Agent progress">
        {progress.map((step, index) => {
          const isCurrent = index === progress.length - 1;
          return (
            <li
              className={isCurrent ? "stream-step current" : "stream-step done"}
              key={`${step.node}-${index}`}
            >
              <span className="stream-step-dot" aria-hidden="true" />
              <span className="stream-step-message">{step.message}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
