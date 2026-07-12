"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type CareerMapNode } from "@/lib/api";
import { CareerMapScene } from "@/lib/career-map/scene";
import NodeDetail from "@/components/career-map/NodeDetail";
import { useCareerMap } from "@/hooks/useCareerMap";

const LEGEND: { color: string; label: string }[] = [
  { color: "#8f7dff", label: "progression" },
  { color: "#ffb98f", label: "pivot" },
  { color: "#7fd6b2", label: "skill-adjacent" },
];

const KIND_HEX: Record<CareerMapNode["kind"], string> = {
  current: "#fafaf8",
  progression: "#8f7dff",
  pivot: "#ffb98f",
  wildcard: "#7fd6b2",
};

/** Playful loading chatter while the LLM charts the map (~1-2 min first time). */
const PLAYFUL = [
  "warming up the telescope…",
  "reading your story so far…",
  "fidgeting with trajectories…",
  "churning through parallel futures…",
  "untangling career threads…",
  "interviewing the wildcards…",
  "asking the stars for references…",
  "plotting escape velocities…",
  "weighing pivots against gravity…",
  "polishing your constellations…",
  "connecting the dots (literally)…",
];

export default function CareerMapPage() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CareerMapScene | null>(null);
  const { map, progress, loading, error, expanding, expandError, expand, regenerate, retry } = useCareerMap();

  const [selected, setSelected] = useState<CareerMapNode | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [focus, setFocus] = useState<{ id: string; title: string; kind: CareerMapNode["kind"]; index: number; total: number } | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [focusList, setFocusList] = useState<CareerMapNode[]>([]);
  const [spawn, setSpawn] = useState<{ born: number; total: number } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [playIdx, setPlayIdx] = useState(0);
  const firstBuild = useRef(true);

  // resume gate — mirrors backend 404 behavior
  useEffect(() => {
    api.getResume().catch((e) => {
      if (e instanceof ApiError && e.status === 404) router.push("/onboarding");
    });
  }, [router]);

  // scene lifecycle
  useEffect(() => {
    if (!containerRef.current || sceneRef.current) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sceneRef.current = new CareerMapScene(
      containerRef.current,
      {
        onHover: () => {},
        onDiveComplete: (node) => {
          setSelected(node);
          setDetailOpen(true);
        },
        onSpawn: (born, total) => setSpawn({ born, total }),
        onFocus: (node, index, total) => setFocus({ id: node.id, title: node.title, kind: node.kind, index, total }),
      },
      { reducedMotion }
    );
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // feed maps into the scene
  useEffect(() => {
    if (!map || !sceneRef.current) return;
    // a cached map streams zero progress events — that's the discriminator
    // between "loaded instantly from cache" (no stagger) and "just generated"
    // (full spawn stagger), since firstBuild alone can't tell them apart
    sceneRef.current.setMap(map, { animate: firstBuild.current && progress.length > 0 });
    firstBuild.current = false;
  }, [map, progress]);

  // rotate the playful loading lines while the LLM works (index is modulo-cycled,
  // so no reset is needed between runs)
  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setPlayIdx((i) => i + 1), 2400);
    return () => clearInterval(t);
  }, [loading]);

  // pulse the node that's growing new branches as an in-scene beacon
  useEffect(() => {
    sceneRef.current?.setDiscovering(expanding);
  }, [expanding]);

  // keep the open node list in sync when the map is rebuilt (expand/regenerate)
  useEffect(() => {
    if (!listOpen || !map) return;
    setFocusList(sceneRef.current?.focusList() ?? []);
  }, [map, listOpen]);

  // Escape closes the node list (NodeDetail handles its own Escape)
  useEffect(() => {
    if (!listOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setListOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [listOpen]);

  const closeDetail = useCallback(() => {
    setDetailOpen(false);
    sceneRef.current?.zoomOut();
  }, []);

  const handleRegenerate = useCallback(() => {
    firstBuild.current = true;
    setSpawn(null);
    setToast(null);
    regenerate();
  }, [regenerate]);

  // transient-error retry (e.g. network blip) — must not force a paid
  // regeneration, so this re-runs the stream rather than calling regenerate().
  const handleRetry = useCallback(() => {
    firstBuild.current = true;
    setSpawn(null);
    retry();
  }, [retry]);

  const handleRecenter = useCallback(() => {
    sceneRef.current?.recenter();
  }, []);

  const handleExpand = useCallback(async (nodeId: string) => {
    const before = map?.nodes.length ?? 0;
    const expandedTitle = map?.nodes.find((n) => n.id === nodeId)?.title;
    const updated = await expand(nodeId);
    if (updated) {
      const added = updated.nodes.length - before;
      setDetailOpen(false);
      sceneRef.current?.zoomOut();
      setToast(`✦ ${added} new branch${added === 1 ? "" : "es"} discovered${expandedTitle ? ` beyond ${expandedTitle}` : ""}`);
      setTimeout(() => setToast(null), 3200);
    }
  }, [expand, map]);

  const generating = loading && !map;
  const discoveringTitle = expanding ? map?.nodes.find((n) => n.id === expanding)?.title ?? null : null;
  const statusLine = loading
    ? progress[progress.length - 1]?.message ?? "Mapping your career space…"
    : spawn && spawn.born < spawn.total
      ? `Mapping your career space… ${spawn.born}/${spawn.total} roles`
      : map
        ? `${map.nodes.length} roles mapped from your resume`
        : null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#0b0e1c", color: "rgba(250,250,248,0.78)", zIndex: 40 }}>
      <style>{`
        .cmap-bar {
          position: absolute; top: 0; left: 0; right: 0; z-index: 6;
          display: flex; align-items: center; justify-content: space-between; gap: 14px;
          padding: 12px 20px 26px;
          background: linear-gradient(180deg, rgba(11,14,28,0.92) 0%, rgba(11,14,28,0.55) 55%, rgba(11,14,28,0) 100%);
          pointer-events: none;
        }
        .cmap-bar > * { pointer-events: auto; }
        .cmap-cluster { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .cmap-back {
          display: inline-flex; align-items: center; gap: 7px;
          font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(250,250,248,0.65); text-decoration: none;
          border: 1px solid rgba(250,250,248,0.14); border-radius: 99px;
          padding: 6px 13px; background: rgba(20,24,48,0.45);
          backdrop-filter: blur(8px); transition: border-color 0.2s, color 0.2s;
        }
        .cmap-back:hover { border-color: rgba(199,185,255,0.5); color: #fafaf8; }
        .cmap-wordmark {
          font-size: 11.5px; letter-spacing: 0.26em; color: #fafaf8; white-space: nowrap;
          text-shadow: 0 0 18px rgba(199,185,255,0.45);
        }
        .cmap-wordmark span { color: rgba(250,250,248,0.4); }
        .cmap-status { font-size: 10.5px; letter-spacing: 0.08em; color: #c7b9ff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .cmap-legend { display: flex; align-items: center; gap: 14px; }
        .cmap-legend .leg { display: flex; align-items: center; gap: 6px; font-size: 10px; letter-spacing: 0.1em; color: rgba(250,250,248,0.45); text-transform: uppercase; }
        .cmap-legend .leg i { width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px currentColor; }
        .cmap-pill {
          font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
          background: rgba(20,24,48,0.45); color: rgba(250,250,248,0.6);
          border: 1px solid rgba(250,250,248,0.16); border-radius: 99px;
          padding: 6px 14px; cursor: pointer; backdrop-filter: blur(8px);
          transition: border-color 0.2s, color 0.2s;
        }
        .cmap-pill:hover:not(:disabled) { border-color: rgba(199,185,255,0.5); color: #fafaf8; }
        .cmap-pill:disabled { cursor: wait; opacity: 0.5; }
        @media (max-width: 720px) {
          .cmap-legend, .cmap-status { display: none; }
        }

        .cmap-loading {
          position: absolute; inset: 0; z-index: 5;
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 22px;
          background: radial-gradient(ellipse at 50% 45%, rgba(20,24,48,0.5) 0%, rgba(11,14,28,0.92) 75%);
          /* delayed fade-in: instant cached loads resolve before this appears */
          opacity: 0; animation: cmap-fade 0.4s ease 0.35s forwards;
          pointer-events: none;
        }
        .cmap-orb {
          width: 88px; height: 88px; border-radius: 50%;
          background:
            radial-gradient(circle at 34% 34%, rgba(255,255,255,0.9) 0%, rgba(199,185,255,0.85) 22%, rgba(78,63,216,0.55) 58%, rgba(78,63,216,0) 75%),
            radial-gradient(circle at 68% 62%, rgba(255,217,194,0.5) 0%, rgba(255,217,194,0) 55%),
            radial-gradient(circle at 42% 72%, rgba(191,234,216,0.45) 0%, rgba(191,234,216,0) 55%);
          box-shadow: 0 0 60px 18px rgba(143,125,255,0.35), 0 0 120px 40px rgba(143,125,255,0.12);
          animation: cmap-pulse 2.4s ease-in-out infinite;
        }
        .cmap-play { font-size: 13px; letter-spacing: 0.06em; color: #fafaf8; }
        .cmap-stage { font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(199,185,255,0.75); }
        .cmap-note { font-size: 11px; color: rgba(250,250,248,0.35); }
        @keyframes cmap-pulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.12); filter: brightness(1.25); }
        }
        @keyframes cmap-pulse-soft {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
        @keyframes cmap-fade { to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .cmap-orb { animation: none; }
          .cmap-loading { animation-delay: 0s; animation-duration: 0s; }
        }
      `}</style>

      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />

      {/* themed top bar — the global nav stays out of this space */}
      <header className="cmap-bar">
        <div className="cmap-cluster">
          <Link href="/dashboard" className="cmap-back mono">← Dashboard</Link>
          <div className="cmap-wordmark mono">AURA <span>·</span> CAREER MAP</div>
          {statusLine && !generating && (
            <div className="cmap-status mono" aria-live="polite">{statusLine}</div>
          )}
        </div>
        <div className="cmap-cluster">
          <div className="cmap-legend mono">
            {LEGEND.map((l) => (
              <div key={l.label} className="leg" style={{ color: undefined }}>
                <i style={{ background: l.color, color: l.color }} />
                {l.label}
              </div>
            ))}
          </div>
          <button className="cmap-pill mono" onClick={handleRecenter} disabled={generating}>
            Recenter
          </button>
          <button className="cmap-pill mono" onClick={handleRegenerate} disabled={loading}>
            Regenerate
          </button>
        </div>
      </header>

      {/* loading screen while the LLM charts the map */}
      {generating && (
        <div className="cmap-loading" role="status">
          <div className="cmap-orb" />
          <div className="cmap-play mono" aria-live="polite">{PLAYFUL[playIdx % PLAYFUL.length]}</div>
          <div className="cmap-stage mono">{progress[progress.length - 1]?.message ?? "Warming up…"}</div>
          <div className="cmap-note">first mapping takes a minute or two — charting every route from your resume</div>
        </div>
      )}

      {/* full node list — opened from the carousel, click to center */}
      {listOpen && focus && !generating && (
        <div className="mono" style={{ position: "absolute", bottom: 92, left: "50%", transform: "translateX(-50%)", width: "min(340px, 86vw)", maxHeight: "46vh", overflowY: "auto", background: "rgba(15,18,38,0.94)", border: "1px solid rgba(250,250,248,0.16)", borderRadius: 14, padding: 6, backdropFilter: "blur(10px)", zIndex: 7 }}>
          {focusList.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                sceneRef.current?.focusTo(n.id);
                setListOpen(false);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%",
                background: n.id === focus.id ? "rgba(250,250,248,0.08)" : "transparent",
                border: "none", borderRadius: 9, padding: "8px 10px", cursor: "pointer",
                color: "rgba(250,250,248,0.85)", fontSize: 11.5, letterSpacing: "0.06em", textAlign: "left",
              }}
              className="mono"
            >
              <i style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: KIND_HEX[n.kind], boxShadow: `0 0 8px ${KIND_HEX[n.kind]}` }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</span>
              <span style={{ fontSize: 9.5, color: "rgba(250,250,248,0.4)", flexShrink: 0 }}>
                {n.kind === "current" ? "now" : n.duration}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* focus carousel: ‹ node › — arrows step, enter/click dives */}
      {focus && !generating && (
        <div className="cmap-carousel mono" style={{ position: "absolute", bottom: 46, left: "50%", transform: "translateX(-50%)", display: "flex", alignItems: "center", gap: 14, background: "rgba(20,24,48,0.6)", border: "1px solid rgba(250,250,248,0.16)", borderRadius: 99, padding: "7px 16px", backdropFilter: "blur(8px)", zIndex: 6 }}>
          <button
            onClick={() => sceneRef.current?.focusPrev()}
            aria-label="Focus previous node"
            style={{ background: "none", border: "none", color: "rgba(250,250,248,0.6)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
          >
            ‹
          </button>
          <button
            onClick={() => sceneRef.current?.diveFocused()}
            title="Dive into this node (Enter)"
            style={{ background: "none", border: "none", cursor: "pointer", color: KIND_HEX[focus.kind], fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap", maxWidth: "40vw", overflow: "hidden", textOverflow: "ellipsis", padding: 0 }}
            className="mono"
          >
            {focus.title}
          </button>
          <button
            onClick={() => {
              if (!listOpen) setFocusList(sceneRef.current?.focusList() ?? []);
              setListOpen((o) => !o);
            }}
            aria-expanded={listOpen}
            aria-label="Show all nodes"
            className="mono"
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(250,250,248,0.35)", fontSize: 9.5, letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
          >
            {focus.index}/{focus.total}
            <span aria-hidden="true" style={{ display: "inline-block", transition: "transform 0.2s", transform: listOpen ? "rotate(180deg)" : "none", fontSize: 8 }}>▲</span>
          </button>
          <button
            onClick={() => sceneRef.current?.focusNext()}
            aria-label="Focus next node"
            style={{ background: "none", border: "none", color: "rgba(250,250,248,0.6)", fontSize: 16, cursor: "pointer", padding: "0 4px", lineHeight: 1 }}
          >
            ›
          </button>
        </div>
      )}

      <div className="mono" style={{ position: "absolute", bottom: 18, left: "50%", transform: "translateX(-50%)", fontSize: 10, letterSpacing: "0.14em", color: "rgba(250,250,248,0.4)", textTransform: "uppercase", whiteSpace: "nowrap", pointerEvents: "none", zIndex: 6 }}>
        ← → focus · enter dives · drag orbits · scroll zooms · double-click recenters
      </div>

      {discoveringTitle && (
        <div className="mono" role="status" style={{ position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "rgba(20,24,48,0.92)", border: "1px solid rgba(191,234,216,0.35)", color: "#bfead8", fontSize: 11.5, padding: "8px 16px", borderRadius: 99, zIndex: 6, animation: "cmap-pulse-soft 1.6s ease-in-out infinite" }}>
          ✦ discovering new branches beyond {discoveringTitle}…
        </div>
      )}

      {toast && !discoveringTitle && (
        <div className="mono" style={{ position: "absolute", bottom: 96, left: "50%", transform: "translateX(-50%)", background: "rgba(20,24,48,0.92)", border: "1px solid rgba(199,185,255,0.35)", color: "#c7b9ff", fontSize: 11.5, padding: "8px 16px", borderRadius: 99, zIndex: 6 }}>
          {toast}
        </div>
      )}

      {error && (
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(11,14,28,0.85)", zIndex: 7 }}>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <p style={{ margin: 0, maxWidth: "42ch" }}>{error}</p>
            <button
              onClick={handleRetry}
              style={{ fontSize: 14.5, fontWeight: 600, borderRadius: 12, padding: "12px 22px", cursor: "pointer", background: "#fafaf8", color: "#1a1d29", border: "none" }}
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <NodeDetail
        node={selected}
        open={detailOpen}
        onClose={closeDetail}
        onExpand={handleExpand}
        expanding={expanding !== null}
        expandError={expandError}
      />
    </div>
  );
}
