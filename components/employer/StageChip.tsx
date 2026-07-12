import type { CSSProperties } from "react";
import type { StageDef } from "@/lib/employerApi";
import { stageColor } from "@/app/employer/data";

export default function StageChip({
  stage,
  stages,
  className = "",
}: {
  stage: string;
  /** The owning job's configured stage list; falls back to the defaults. */
  stages?: StageDef[] | null;
  className?: string;
}) {
  const color = stageColor(stage, stages);
  return (
    <span
      className={`chip stage-chip ${className}`.trim()}
      style={{ "--stage-c": color } as CSSProperties}
    >
      {stage}
    </span>
  );
}
