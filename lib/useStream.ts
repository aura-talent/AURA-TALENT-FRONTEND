"use client";

import { useState, useCallback } from "react";
import { getUserId } from "./api";
import { parseSseBuffer } from "./sse";

export interface ProgressEvent {
  node: string;
  message: string;
}

export interface StreamState<T> {
  progress: ProgressEvent[];
  result: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Streams an SSE endpoint through the /api/backend proxy.
 * path is relative (e.g. "jobs/evaluate/stream").
 * user_id is injected automatically.
 */
export function useStream<T, B extends Record<string, unknown>>(path: string) {
  const [progress, setProgress] = useState<ProgressEvent[]>([]);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = useCallback(() => {
    setProgress([]);
    setResult(null);
    setError(null);
    setLoading(false);
  }, []);

  const run = useCallback(
    async (body: B) => {
      setLoading(true);
      setProgress([]);
      setResult(null);
      setError(null);

      try {
        const res = await fetch(`/api/backend/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: getUserId(), ...body }),
        });

        if (!res.ok) {
          let detail = `Request failed (${res.status})`;
          try {
            const data = await res.json();
            if (data.detail)
              detail =
                typeof data.detail === "string"
                  ? data.detail
                  : JSON.stringify(data.detail);
          } catch {
            /* non-JSON error body */
          }
          setError(detail);
          return;
        }

        if (!res.body) {
          setError("Stream connection failed — no response body.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parsed = parseSseBuffer(buffer);
          buffer = parsed.remainder;

          for (const message of parsed.messages) {
            if (message.event === "progress")
              setProgress((p) => [...p, message.data as ProgressEvent]);
            if (message.event === "result") setResult(message.data as T);
            if (message.event === "error")
              setError((message.data as { detail?: string }).detail ?? "Unknown error");
          }
        }
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Stream connection failed — try again."
        );
      } finally {
        setLoading(false);
      }
    },
    [path]
  );

  return { run, reset, progress, result, error, loading };
}
