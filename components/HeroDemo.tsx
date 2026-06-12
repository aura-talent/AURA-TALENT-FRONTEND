"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

const REQS = [
  { mark: "OK", gap: false, text: "PYTHON + LLM ORCHESTRATION" },
  { mark: "OK", gap: false, text: "CLIENT-FACING DEPLOYMENT ×3" },
  { mark: "OK", gap: false, text: "RAG PIPELINES IN PRODUCTION" },
  { mark: "ADJ", gap: true, text: "KUBERNETES → CLOUD RUN, GKE" },
];

const BLOCKS = ["A", "B", "C", "D", "E", "F", "G"];

const SCORE = 4.2;
const SIZE = 124;
const STROKE = 6;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const TARGET = CIRC * (1 - SCORE / 5);

/**
 * Blueprint readout of an evaluation assembling itself — same wireframe
 * language as the diorama behind it. Requirements print line by line,
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

      tl.from(q(".eval-panel"), { y: 24, autoAlpha: 0, duration: 0.7 })
        .from(q(".eval-head"), { autoAlpha: 0 }, "-=0.3")
        .from(q(".eval-req"), { x: -14, autoAlpha: 0, stagger: 0.14 }, "-=0.15")
        .from(q(".eval-block"), { autoAlpha: 0, stagger: 0.05 }, "-=0.2")
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
          q(".eval-verdict"),
          { autoAlpha: 0, duration: 0.45 },
          "-=0.25"
        );
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="eval-wrap" ref={root} aria-hidden="true">
      <div className="eval-panel">
        <span className="eval-tick eval-tick-tl" />
        <span className="eval-tick eval-tick-tr" />
        <span className="eval-tick eval-tick-bl" />
        <span className="eval-tick eval-tick-br" />

        <div className="eval-head">
          <div>
            <div className="eval-kicker">FIT_EVALUATION // LIVE</div>
            <div className="eval-role">Forward Deployed AI Engineer</div>
            <div className="eval-co">LAYER_ONE_AI · REMOTE · FULL-TIME</div>
          </div>
          <div className="eval-status">
            <span className="eval-dot" />
            LEGIT: PASS
          </div>
        </div>

        <div className="eval-body">
          <div className="eval-reqs">
            {REQS.map((r) => (
              <div className="eval-req" key={r.text}>
                <span className={r.gap ? "eval-mark gap" : "eval-mark"}>
                  [{r.mark}]
                </span>
                <span>{r.text}</span>
              </div>
            ))}
          </div>

          <div className="eval-chart">
            <div className="dial" style={{ fontSize: SIZE / 6.5 }}>
              <svg width={SIZE} height={SIZE}>
                <circle
                  className="eval-dial-track"
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray="2 3"
                />
                <circle
                  ref={ring}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={R}
                  fill="none"
                  stroke="var(--iris)"
                  strokeWidth={STROKE}
                  strokeDasharray={CIRC}
                  strokeDashoffset={TARGET}
                />
              </svg>
              <div className="eval-dial-value">
                <span className="eval-dial-num" ref={num}>
                  {SCORE.toFixed(1)}
                </span>
                <div className="eval-dial-outof">/ 5.0</div>
              </div>
            </div>
            <div className="eval-chart-label">FIT_SCORE</div>
          </div>
        </div>

        <div className="eval-foot">
          <div className="eval-blocks">
            {BLOCKS.map((b) => (
              <span className="eval-block" key={b}>
                {b}
              </span>
            ))}
          </div>
          <span className="eval-verdict">→ WORTH_APPLYING</span>
        </div>
      </div>
    </div>
  );
}
