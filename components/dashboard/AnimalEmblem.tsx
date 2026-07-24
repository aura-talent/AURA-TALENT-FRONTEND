"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { EmblemScene } from "@/lib/animal/emblem-scene";

const EMBLEM_ANIMAL = "fox-head"; // clean low-poly head, flat-shaded, cursor-following

/** Dashboard entry point for the Work Animal module: a porcelain head in an
 * emblem ring that turns to look at the cursor, over a click-through CTA. */
export default function AnimalEmblem() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<EmblemScene | null>(null);

  // scene mounts once + loads the default head
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canvasRef.current && !sceneRef.current) {
      sceneRef.current = new EmblemScene(canvasRef.current, { reducedMotion: rm });
      sceneRef.current.load(EMBLEM_ANIMAL);
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // the figurine looks toward the cursor anywhere on the page
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const el = canvasRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      sceneRef.current?.setPointer(
        (e.clientX - cx) / (window.innerWidth / 2),
        (e.clientY - cy) / (window.innerHeight / 2)
      );
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  return (
    <div className="emblem">
      <style>{`
        .emblem { display: flex; flex-direction: column; align-items: center; gap: 1.1rem; }
        .emblem-canvas { width: 220px; height: 220px; }
        .emblem-cta {
          display: inline-flex; align-items: center; gap: 0.5rem;
          font-family: var(--font-space), monospace; font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; text-decoration: none;
          color: var(--ink); background: var(--surface);
          border: 1px solid var(--ink-30); padding: 0.7rem 1.4rem;
          transition: border-color .2s ease, background-color .2s ease, color .2s ease;
        }
        .emblem-cta:hover { border-color: var(--iris); background: var(--iris); color: #fff; }
      `}</style>

      <div ref={canvasRef} className="emblem-canvas" aria-hidden="true" />

      <Link href="/animal" className="emblem-cta">
        Discover your work animal →
      </Link>
    </div>
  );
}
