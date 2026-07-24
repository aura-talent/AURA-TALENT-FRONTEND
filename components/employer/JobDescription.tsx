"use client";

import { useState } from "react";

const DEFAULT_PREVIEW_CHARS = 220;

/** Truncated job description with a "See full description" / "Show less"
 * toggle — shared by the job detail page header and the pipeline board's
 * side drawer, which each pass their own `className` for sizing. */
export default function JobDescription({
  text,
  maxChars = DEFAULT_PREVIEW_CHARS,
  className = "employer-job-description",
}: {
  text: string;
  maxChars?: number;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = text.length > maxChars;
  const shown = !expanded && needsTruncation
    ? `${text.slice(0, maxChars).trimEnd()}…`
    : text;
  return (
    <p className={className}>
      {shown}
      {needsTruncation && (
        <button
          type="button"
          className="employer-job-description-toggle"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Show less" : "See full description"}
        </button>
      )}
    </p>
  );
}
