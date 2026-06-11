"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const REQS = [
  { tick: "✓", gap: false, text: "Python + LLM orchestration — matches your resume" },
  { tick: "✓", gap: false, text: "Client-facing deployment — 3 projects cited" },
  { tick: "✓", gap: false, text: "RAG pipelines in production — direct match" },
  { tick: "△", gap: true, text: "Kubernetes — adjacent: Cloud Run, GKE basics" },
];

const BLOCKS = ["A Role", "B Match", "C Level", "D Comp", "E Edits", "F Interview", "G Legit"];

const SCORE = 4.2;
const SIZE = 130;
const STROKE = 9;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const TARGET = CIRC * (1 - SCORE / 5);

/**
 * The hero IS the product: an evaluation assembling itself.
 * One orchestrated GSAP timeline — requirements land, blocks stack,
 * the dial sweeps, the verdict stamps. Reduced motion sees the final frame.
 */
export default function HeroDemo() {
  const root = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const num = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const counter = { v: 0 };
      const tl = gsap.timeline({
        defaults: { ease: "power2.out", duration: 0.55 },
        delay: 0.4,
      });

      tl.from(q(".demo-card"), { y: 32, autoAlpha: 0, duration: 0.7 })
        .from(q(".demo-head"), { autoAlpha: 0 }, "-=0.3")
        .from(q(".demo-req"), { x: -18, autoAlpha: 0, stagger: 0.14 }, "-=0.15")
        .from(q(".demo-block"), { y: 8, autoAlpha: 0, stagger: 0.06 }, "-=0.2")
        .fromTo(
          ring.current,
          { strokeDashoffset: CIRC },
          { strokeDashoffset: TARGET, duration: 1.2, ease: "power3.inOut" },
          "-=0.5"
        )
        .to(
          counter,
          {
            v: SCORE,
            duration: 1.2,
            ease: "power3.inOut",
            onUpdate: () => {
              if (num.current) num.current.textContent = counter.v.toFixed(1);
            },
          },
          "<"
        )
        .from(
          q(".demo-verdict"),
          { scale: 1.5, autoAlpha: 0, duration: 0.45, ease: "back.out(2.5)" },
          "-=0.25"
        );
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="demo-wrap" ref={root} aria-hidden="true">
      <div className="aura-glow" />
      <div className="demo-card">
        <div className="demo-head">
          <div>
            <div className="demo-role">Forward Deployed AI Engineer</div>
            <div className="demo-co">Layer One AI · Remote · Full-time</div>
          </div>
          <span className="chip chip-tier-high">Legit ✓</span>
        </div>
        <div className="demo-body">
          <div className="demo-reqs">
            {REQS.map((r) => (
              <div className="demo-req" key={r.text}>
                <span className={r.gap ? "tick gap" : "tick"}>{r.tick}</span>
                <span>{r.text}</span>
              </div>
            ))}
            <div className="demo-blocks">
              {BLOCKS.map((b) => (
                <span className="demo-block" key={b}>{b}</span>
              ))}
            </div>
            <div>
              <span className="demo-verdict">Worth applying →</span>
            </div>
          </div>
          <div className="dial" style={{ fontSize: SIZE / 6.5 }}>
            <svg width={SIZE} height={SIZE}>
              <circle className="dial-track" cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} />
              <circle
                ref={ring}
                cx={SIZE / 2} cy={SIZE / 2} r={R}
                fill="none" stroke="var(--score-good)" strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={TARGET}
              />
            </svg>
            <div className="dial-value">
              <span className="dial-num" ref={num} style={{ color: "var(--score-good)" }}>
                {SCORE.toFixed(1)}
              </span>
              <div className="dial-outof">/ 5</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
