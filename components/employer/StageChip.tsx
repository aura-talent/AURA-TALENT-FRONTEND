import type { CSSProperties } from "react";
import { stageColors } from "@/app/employer/data";

export default function StageChip({
  stage,
  className = "",
}: {
  stage: string;
  className?: string;
}) {
  const color = stageColors[stage as keyof typeof stageColors] ?? "var(--ink-55)";
  return (
    <span
      className={`chip stage-chip ${className}`.trim()}
      style={{ "--stage-c": color } as CSSProperties}
    >
      {stage}
    </span>
  );
}
