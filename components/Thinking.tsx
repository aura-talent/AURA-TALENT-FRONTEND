"use client";

import { useEffect, useState } from "react";

/**
 * Long-running LLM calls (20-60s) need an honest wait state. The status
 * lines describe what the backend is actually doing, in order.
 */
export default function Thinking({ lines }: { lines: string[] }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setI((n) => Math.min(n + 1, lines.length - 1)),
      9000
    );
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div className="thinking" role="status" aria-live="polite">
      <div className="thinking-orb" />
      <p className="thinking-status">{lines[i]}</p>
    </div>
  );
}
