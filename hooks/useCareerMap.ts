"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError, type CareerMapOut } from "@/lib/api";
import { useStream } from "@/lib/useStream";

export interface UseCareerMap {
  map: CareerMapOut | null;
  progress: { node: string; message: string }[];
  loading: boolean;
  error: string | null;
  expanding: string | null; // node id being expanded, or null
  expandError: string | null;
  expand: (nodeId: string) => Promise<CareerMapOut | null>;
  regenerate: () => void;
  retry: () => void;
}

export function useCareerMap(): UseCareerMap {
  const stream = useStream<CareerMapOut, { force_refresh?: boolean }>("career/map/stream");
  const [map, setMap] = useState<CareerMapOut | null>(null);
  const [expanding, setExpanding] = useState<string | null>(null);
  const [expandError, setExpandError] = useState<string | null>(null);
  const started = useRef(false);

  // The stream endpoint returns a cached map instantly when one exists,
  // so streaming is the single load path (first visit and return visits).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void stream.run({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (stream.result) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMap(stream.result);
    }
  }, [stream.result]);

  const expand = useCallback(
    async (nodeId: string): Promise<CareerMapOut | null> => {
      setExpanding(nodeId);
      setExpandError(null);
      try {
        const updated = await api.careerMapExpand(nodeId);
        setMap(updated);
        return updated;
      } catch (e) {
        setExpandError(e instanceof ApiError ? e.message : "Expansion failed — try again.");
        return null;
      } finally {
        setExpanding(null);
      }
    },
    []
  );

  const regenerate = useCallback(() => {
    setMap(null);
    void stream.run({ force_refresh: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.run]);

  // transient-error retry: re-run the stream without force_refresh and
  // without clearing `map`, so a network blip doesn't force a paid
  // regeneration when a stored map already exists
  const retry = useCallback(() => {
    void stream.run({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.run]);

  return {
    map,
    progress: stream.progress,
    loading: stream.loading,
    error: stream.error,
    expanding,
    expandError,
    expand,
    regenerate,
    retry,
  };
}
