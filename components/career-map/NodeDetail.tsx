// components/career-map/NodeDetail.tsx
// The inside-of-a-node dossier. The three.js scene provides the glow "room";
// this overlay is a museum plaque floating in it — vertical spine, ghost
// typography, numbered manifest, waypoint itinerary. No cards, no chips.
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { CareerMapNode } from "@/lib/api";

const KIND_COLOR: Record<CareerMapNode["kind"], string> = {
  current: "#fafaf8",
  progression: "#8f7dff",
  pivot: "#ffb98f",
  wildcard: "#7fd6b2",
};
const KIND_LABEL: Record<CareerMapNode["kind"], string> = {
  current: "you today",
  progression: "progression",
  pivot: "pivot",
  wildcard: "wildcard",
};

export default function NodeDetail({
  node, open, onClose, onExpand, expanding, expandError,
}: {
  node: CareerMapNode | null;
  open: boolean;
  onClose: () => void;
  onExpand: (id: string) => void;
  expanding: boolean;
  expandError: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // staggered dossier reveal
  useEffect(() => {
    if (!open || !ref.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-reveal]",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.06, ease: "power2.out", delay: 0.05 }
      );
      gsap.fromTo(
        ".nd-rail",
        { scaleY: 0 },
        { scaleY: 1, transformOrigin: "top", duration: 0.7, ease: "power3.out" }
      );
      gsap.fromTo(".nd-ghost", { opacity: 0 }, { opacity: 1, duration: 1.1, delay: 0.25, ease: "power2.out" });
    }, ref);
    return () => ctx.revert();
  }, [open, node?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !node) return null;
  const col = KIND_COLOR[node.kind];
  const fitLit = Math.round(Math.min(Math.max(node.fit, 0), 5));

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={node.title}
      className="nd-overlay"
      style={{ "--nd-col": col } as React.CSSProperties}
    >
      <style>{`
        .nd-overlay {
          position: fixed; inset: 0; z-index: 20; overflow-y: auto;
          color: #fafaf8;
          background: radial-gradient(ellipse at 50% 42%,
            rgba(11,14,28,0) 0%, rgba(11,14,28,0.55) 58%, rgba(11,14,28,0.9) 100%);
        }
        .nd-inner {
          position: relative; max-width: 1060px; margin: 0 auto; min-height: 100%;
          box-sizing: border-box;
          padding: clamp(20px, 4.5vh, 48px) clamp(20px, 4vw, 48px);
          display: grid; grid-template-columns: 52px 1fr;
          gap: clamp(20px, 3.5vw, 44px);
        }
        /* ── vertical spine: kind + constellation fit meter ── */
        .nd-rail {
          display: flex; flex-direction: column; align-items: center; gap: 20px;
          border-right: 1px solid rgba(250,250,248,0.14); padding: 6px 14px 6px 0;
        }
        .nd-rail-kind {
          writing-mode: vertical-rl; transform: rotate(180deg);
          font-size: 10px; letter-spacing: 0.34em; text-transform: uppercase;
          color: var(--nd-col); text-shadow: 0 0 14px var(--nd-col);
        }
        .nd-fitdots { display: flex; flex-direction: column; gap: 8px; }
        .nd-fitdots i {
          width: 7px; height: 7px; transform: rotate(45deg); display: block;
        }
        .nd-fitdots i.lit { background: var(--nd-col); box-shadow: 0 0 9px var(--nd-col); }
        .nd-fitdots i.dim { border: 1px solid rgba(250,250,248,0.28); }
        .nd-rail-fit {
          writing-mode: vertical-rl; transform: rotate(180deg);
          font-size: 10px; letter-spacing: 0.18em; color: rgba(250,250,248,0.45);
        }
        /* ── content ── */
        .nd-content { display: flex; flex-direction: column; min-width: 0; }
        .nd-top { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .nd-crumb {
          font-size: 10px; letter-spacing: 0.24em; text-transform: uppercase;
          color: rgba(250,250,248,0.4);
        }
        .nd-crumb::before {
          content: ""; display: inline-block; width: 7px; height: 7px; border-radius: 50%;
          background: var(--nd-col); box-shadow: 0 0 10px var(--nd-col);
          margin-right: 10px; vertical-align: 1px;
        }
        .nd-close {
          background: none; border: none; cursor: pointer; padding: 8px 0 8px 16px;
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(250,250,248,0.5); transition: color 0.2s;
        }
        .nd-close:hover { color: #fafaf8; }
        .nd-close:focus-visible { outline: 2px solid var(--nd-col); outline-offset: 3px; }
        /* ── head: ghost duration behind an oversized title ── */
        .nd-head { position: relative; margin: clamp(10px, 3vh, 30px) 0 clamp(18px, 3.5vh, 34px); }
        .nd-ghost {
          position: absolute; right: -2%; top: -0.55em; z-index: 0;
          font-family: var(--font-display, inherit); font-weight: 700;
          font-size: clamp(3.6rem, 12vw, 8rem); line-height: 1;
          letter-spacing: -0.02em; text-transform: uppercase; white-space: nowrap;
          color: transparent; -webkit-text-stroke: 1px color-mix(in srgb, var(--nd-col) 26%, transparent);
          pointer-events: none; user-select: none;
        }
        .nd-title {
          position: relative; z-index: 1; margin: 0 0 16px; max-width: 15ch;
          font-family: var(--font-display, inherit); font-weight: 700;
          font-size: clamp(2.4rem, 6.5vw, 4.4rem); line-height: 0.98;
          letter-spacing: -0.025em; text-wrap: balance;
          text-shadow: 0 2px 40px rgba(11,14,28,0.7);
        }
        .nd-meta {
          position: relative; z-index: 1;
          font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(250,250,248,0.62);
        }
        .nd-sep { color: var(--nd-col); margin: 0 12px; }
        /* ── body: asymmetric editorial columns ── */
        .nd-body {
          display: grid; grid-template-columns: 1.05fr 0.9fr;
          gap: clamp(24px, 4vw, 56px); align-items: start;
        }
        .nd-eyebrow {
          display: flex; align-items: center; gap: 12px; margin: 0 0 16px;
          font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase;
          font-weight: 400; color: rgba(250,250,248,0.45);
        }
        .nd-eyebrow::after {
          content: ""; flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(250,250,248,0.2), transparent);
        }
        .nd-lede {
          margin: 0; max-width: 46ch; font-size: 16.5px; line-height: 1.7;
          color: rgba(250,250,248,0.88);
        }
        .nd-lede + .nd-eyebrow { margin-top: 34px; }
        /* gaps: numbered manifest */
        .nd-gaps { list-style: none; margin: 0; padding: 0; }
        .nd-gaps li {
          display: flex; gap: 16px; align-items: baseline; padding: 11px 0;
          border-bottom: 1px solid rgba(250,250,248,0.09);
          font-size: 14px; color: rgba(250,250,248,0.85);
        }
        .nd-idx { font-size: 10.5px; letter-spacing: 0.12em; color: var(--nd-col); }
        /* moves: waypoint itinerary, offset for diagonal flow */
        .nd-itinerary {
          position: relative; display: flex; flex-direction: column; gap: 24px;
          border-left: 1px solid rgba(250,250,248,0.16); padding-left: 24px;
        }
        .nd-move { position: relative; display: flex; flex-direction: column; gap: 4px; }
        .nd-dot {
          position: absolute; left: -29px; top: 4px; width: 9px; height: 9px;
          border-radius: 50%; background: var(--nd-col); box-shadow: 0 0 12px var(--nd-col);
        }
        .nd-cat {
          font-size: 9.5px; letter-spacing: 0.16em; text-transform: uppercase;
          color: var(--nd-col);
        }
        .nd-move b { font-size: 14.5px; font-weight: 600; }
        .nd-move small { font-size: 12.5px; line-height: 1.5; color: rgba(250,250,248,0.55); }
        /* ── actions: text CTA with a traveling arrow, no pills ── */
        .nd-actions {
          display: flex; flex-wrap: wrap; align-items: baseline; gap: 28px;
          margin-top: auto; padding: clamp(24px, 4.5vh, 44px) 0 8px;
        }
        .nd-explore {
          background: none; border: none; border-bottom: 1px solid var(--nd-col);
          cursor: pointer; padding: 10px 2px;
          font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase;
          color: #fafaf8; transition: color 0.2s;
        }
        .nd-explore .nd-arrow { display: inline-block; margin-left: 8px; transition: transform 0.25s ease; }
        .nd-explore:hover:not(:disabled) { color: var(--nd-col); }
        .nd-explore:hover:not(:disabled) .nd-arrow { transform: translateX(7px); }
        .nd-explore:disabled { cursor: wait; animation: nd-breathe 1.6s ease-in-out infinite; }
        .nd-explore:focus-visible { outline: 2px solid var(--nd-col); outline-offset: 4px; }
        .nd-back {
          background: none; border: none; cursor: pointer; padding: 10px 0;
          font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase;
          color: rgba(250,250,248,0.45); transition: color 0.2s;
        }
        .nd-back:hover { color: #fafaf8; }
        .nd-err { font-size: 11.5px; color: #ffb98f; }
        @keyframes nd-breathe { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }
        /* ── small screens: spine goes horizontal, columns stack ── */
        @media (max-width: 760px) {
          .nd-inner { grid-template-columns: 1fr; gap: 18px; }
          .nd-rail {
            flex-direction: row; border-right: none; padding: 0 0 14px;
            border-bottom: 1px solid rgba(250,250,248,0.14);
          }
          .nd-rail-kind, .nd-rail-fit { writing-mode: horizontal-tb; transform: none; }
          .nd-fitdots { flex-direction: row; }
          .nd-body { grid-template-columns: 1fr; }
          .nd-moves-col { margin-top: 0 !important; }
          .nd-ghost { font-size: clamp(2.6rem, 16vw, 4.5rem); top: -0.4em; }
        }
        @media (min-width: 761px) {
          .nd-moves-col { margin-top: 3.4rem; } /* diagonal flow */
        }
        @media (prefers-reduced-motion: reduce) {
          .nd-explore:disabled { animation: none; opacity: 0.6; }
        }
      `}</style>

      <div className="nd-inner">
        <div className="nd-rail mono" aria-hidden="true">
          <span className="nd-rail-kind">{KIND_LABEL[node.kind]}</span>
          <span className="nd-fitdots">
            {[1, 2, 3, 4, 5].map((i) => (
              <i key={i} className={i <= fitLit ? "lit" : "dim"} />
            ))}
          </span>
          <span className="nd-rail-fit">fit {node.fit.toFixed(1)}</span>
        </div>

        <div className="nd-content">
          <div className="nd-top">
            <span className="nd-crumb mono" data-reveal>
              {node.kind === "current" ? "where you stand" : "from your current position"}
            </span>
            <button className="nd-close mono" onClick={onClose} aria-label="Zoom back out to the map">
              esc ✕
            </button>
          </div>

          <div className="nd-head">
            <span className="nd-ghost" aria-hidden="true">
              {node.kind === "current" ? "Now" : node.duration}
            </span>
            <h1 className="nd-title" data-reveal>{node.title}</h1>
            <div
              className="nd-meta mono"
              data-reveal
              aria-label={`${node.kind === "current" ? "You are here" : `${node.duration} away`}${node.salary_hint ? `, ${node.salary_hint}` : ""}, fit ${node.fit.toFixed(1)} out of 5`}
            >
              {node.kind === "current" ? "you are here" : `${node.duration} away`}
              {node.salary_hint && (
                <>
                  <span className="nd-sep">✦</span>
                  {node.salary_hint}
                </>
              )}
              <span className="nd-sep">✦</span>
              fit {node.fit.toFixed(1)} / 5
            </div>
          </div>

          <div className="nd-body">
            <section>
              <h2 className="nd-eyebrow mono" data-reveal>Why you</h2>
              <p className="nd-lede" data-reveal>{node.why}</p>
              {node.skill_gaps.length > 0 && (
                <>
                  <h2 className="nd-eyebrow mono" data-reveal>Gaps to close</h2>
                  <ol className="nd-gaps">
                    {node.skill_gaps.map((g, i) => (
                      <li key={g} data-reveal>
                        <span className="nd-idx mono">{String(i + 1).padStart(2, "0")}</span>
                        {g}
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>

            {node.moves.length > 0 && (
              <section className="nd-moves-col">
                <h2 className="nd-eyebrow mono" data-reveal>The climb</h2>
                <div className="nd-itinerary">
                  {node.moves.map((m) => (
                    <div className="nd-move" key={m.action} data-reveal>
                      <span className="nd-dot" aria-hidden="true" />
                      <span className="nd-cat mono">{m.category}</span>
                      <b>{m.action}</b>
                      <small>{m.why}</small>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="nd-actions" data-reveal>
            {node.expandable && (
              <button
                className="nd-explore mono"
                onClick={() => onExpand(node.id)}
                disabled={expanding}
              >
                {expanding
                  ? `discovering beyond ${node.title}…`
                  : (<>explore further from here<span className="nd-arrow">→</span></>)}
              </button>
            )}
            <button className="nd-back mono" onClick={onClose}>zoom back out</button>
            {expandError && <span className="nd-err mono">{expandError}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
