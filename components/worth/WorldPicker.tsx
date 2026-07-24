"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface WorldMap {
  viewBox: string;
  locations: { id: string; name: string; path: string }[];
}

export interface WorldPickerSelection {
  code: string;
  name: string;
}

/** ISO-2 (lowercase) codes forming the Asian landmass — the one live continent
 * (it's where our SG/MY graduate data lives). Clicking any of it zooms to the
 * SG/MY region, since Singapore is a dot across the whole continent. */
const ASIA = new Set([
  "af", "am", "az", "bh", "bd", "bt", "bn", "kh", "cn", "cy", "ge", "in", "id",
  "ir", "iq", "il", "jp", "jo", "kz", "kw", "kg", "la", "lb", "my", "mv", "mn",
  "mm", "np", "kp", "om", "pk", "ph", "qa", "sa", "sg", "kr", "lk", "sy", "tw",
  "tj", "th", "tl", "tr", "tm", "ae", "uz", "vn", "ye",
]);

/** Countries we actually have data for — these get hover + click when zoomed. */
const LIVE = new Set(["sg", "my"]);

export default function WorldPicker({
  onSelect,
  selected,
}: {
  onSelect?: (sel: WorldPickerSelection) => void;
  selected?: string | null;
}) {
  const [map, setMap] = useState<WorldMap | null>(null);
  const [view, setView] = useState<"world" | "region">("world");
  const [hover, setHover] = useState<{ name: string; x: number; y: number } | null>(null);
  const [sgCenter, setSgCenter] = useState<{ cx: number; cy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fullBox = useRef("0 0 1010 666");
  const rafRef = useRef(0);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  useEffect(() => {
    fetch("/world-map.json")
      .then((r) => r.json())
      .then((d: WorldMap) => {
        setMap(d);
        fullBox.current = d.viewBox;
      })
      .catch(() => {});
  }, []);

  // viewBox is driven imperatively (rAF tween) — never as a controlled prop,
  // or React re-renders would snap it back to full and fight the zoom.
  useEffect(() => {
    if (map && svgRef.current && view === "world") {
      svgRef.current.setAttribute("viewBox", fullBox.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Singapore is a dot — remember its centre for a big INVISIBLE hit-area so
  // it stays easy to hover/click, with no visible marker.
  useEffect(() => {
    const sg = svgRef.current?.querySelector<SVGPathElement>("#sg");
    if (map && sg) {
      const b = sg.getBBox();
      setSgCenter({ cx: b.x + b.width / 2, cy: b.y + b.height / 2 });
    }
  }, [map]);

  const tweenViewBox = useCallback((target: string) => {
    const svg = svgRef.current;
    if (!svg) return;
    cancelAnimationFrame(rafRef.current);
    const from = (svg.getAttribute("viewBox") || fullBox.current).split(/\s+/).map(Number);
    const to = target.split(/\s+/).map(Number);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      svg.setAttribute("viewBox", target);
      return;
    }
    const dur = 850;
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = ease(p);
      const v = from.map((f, i) => f + (to[i] - f) * e);
      svg.setAttribute("viewBox", `${v[0]} ${v[1]} ${v[2]} ${v[3]}`);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const zoomToRegion = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const sg = svg.querySelector<SVGPathElement>("#sg");
    const my = svg.querySelector<SVGPathElement>("#my");
    if (!sg || !my) return;
    const a = sg.getBBox();
    const b = my.getBBox();
    const minX = Math.min(a.x, b.x);
    const minY = Math.min(a.y, b.y);
    const maxX = Math.max(a.x + a.width, b.x + b.width);
    const maxY = Math.max(a.y + a.height, b.y + b.height);
    const w = maxX - minX;
    const h = maxY - minY;
    // pad so SEA neighbours frame the view while SG/MY stay large + hoverable
    const px = w * 0.55;
    const py = h * 0.75;
    tweenViewBox(`${minX - px} ${minY - py} ${w + px * 2} ${h + py * 2}`);
    setView("region");
    setHover(null);
  }, [tweenViewBox]);

  const backToWorld = useCallback(() => {
    tweenViewBox(fullBox.current);
    setView("world");
    setHover(null);
  }, [tweenViewBox]);

  const track = useCallback((e: React.MouseEvent, name: string) => {
    const r = wrapRef.current?.getBoundingClientRect();
    setHover({ name, x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) });
  }, []);

  function classFor(id: string): string {
    if (view === "world") return ASIA.has(id) ? "wp-asia" : "wp-land";
    if (LIVE.has(id)) return selected === id.toUpperCase() ? "wp-live wp-sel" : "wp-live";
    return "wp-land";
  }

  return (
    <div ref={wrapRef} className="wp-wrap">
      <style>{`
        .wp-wrap { position: relative; width: 100%; }
        .wp-svg { display: block; width: 100%; height: auto; }
        .wp-land { fill: rgba(26,29,41,0.14); stroke: var(--porcelain); stroke-width: 0.3; pointer-events: none; }
        .wp-asia { fill: rgba(78,63,216,0.16); stroke: var(--porcelain); stroke-width: 0.3; cursor: pointer; pointer-events: auto; transition: fill .25s ease; animation: wpPulse 3.2s ease-in-out infinite; }
        .wp-asia:hover { fill: rgba(78,63,216,0.32); }
        .wp-live { fill: rgba(78,63,216,0.20); stroke: var(--porcelain); stroke-width: 0.4; cursor: pointer; pointer-events: auto; transition: fill .18s ease; }
        .wp-live:hover { fill: rgba(78,63,216,0.55); }
        .wp-sel { fill: var(--iris) !important; }
        @keyframes wpPulse { 0%,100% { opacity: 0.75; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .wp-asia { animation: none; } }
        .wp-tip { position: absolute; z-index: 5; transform: translate(-50%, -140%); pointer-events: none;
          background: var(--ink); color: var(--porcelain); font-family: var(--font-space), monospace;
          font-size: 0.66rem; letter-spacing: 0.04em; text-transform: uppercase; padding: 0.3rem 0.6rem; white-space: nowrap; }
        .wp-back { position: absolute; top: 0.75rem; left: 0.75rem; z-index: 5;
          font-family: var(--font-space), monospace; font-size: 0.66rem; letter-spacing: 0.08em; text-transform: uppercase;
          background: var(--surface); border: 1px solid var(--ink-30); color: var(--ink-72); padding: 0.4rem 0.8rem; cursor: pointer; }
        .wp-hint { position: absolute; bottom: 0.75rem; left: 50%; transform: translateX(-50%); z-index: 4;
          font-family: var(--font-space), monospace; font-size: 0.66rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-55); }
      `}</style>

      {view === "region" && (
        <button type="button" className="wp-back" onClick={backToWorld}>
          ← Back to world
        </button>
      )}

      <svg
        ref={svgRef}
        className="wp-svg"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Pick a country"
      >
        {map?.locations.map((loc) => {
          const cls = classFor(loc.id);
          const interactive = cls.startsWith("wp-asia") || cls.startsWith("wp-live");
          return (
            <path
              key={loc.id}
              id={loc.id}
              d={loc.path}
              className={cls}
              onMouseEnter={interactive && view === "region" ? (e) => track(e, loc.name) : undefined}
              onMouseMove={interactive && view === "region" ? (e) => track(e, loc.name) : undefined}
              onMouseLeave={interactive ? () => setHover(null) : undefined}
              onClick={
                view === "world" && ASIA.has(loc.id)
                  ? zoomToRegion
                  : LIVE.has(loc.id)
                    ? () => onSelect?.({ code: loc.id.toUpperCase(), name: loc.name })
                    : undefined
              }
            />
          );
        })}

        {view === "region" && sgCenter && (
          <circle
            cx={sgCenter.cx}
            cy={sgCenter.cy}
            r={5}
            fill="transparent"
            style={{ cursor: "pointer", pointerEvents: "auto" }}
            onMouseEnter={(e) => track(e, "Singapore")}
            onMouseMove={(e) => track(e, "Singapore")}
            onMouseLeave={() => setHover(null)}
            onClick={() => onSelect?.({ code: "SG", name: "Singapore" })}
          />
        )}
      </svg>

      {hover && (
        <div className="wp-tip" style={{ left: hover.x, top: hover.y }}>
          {hover.name}
        </div>
      )}

      <div className="wp-hint">
        {view === "world" ? "▸ Click Asia to zoom in" : "Hover a country · click to lock"}
      </div>
    </div>
  );
}
