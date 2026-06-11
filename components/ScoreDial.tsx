"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

export function scoreColor(score: number): string {
  if (score >= 4.5) return "var(--score-strong)";
  if (score >= 4.0) return "var(--score-good)";
  if (score >= 3.5) return "var(--score-fair)";
  return "var(--score-weak)";
}

/**
 * The signature element: a 1-5 score as a circular gauge.
 * Animates the sweep + counts the number up on mount (reduced motion: static).
 */
export default function ScoreDial({
  score,
  size = 132,
  animate = true,
}: {
  score: number;
  size?: number;
  animate?: boolean;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  const stroke = Math.max(6, size / 16);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const target = circumference * (1 - Math.min(score, 5) / 5);
  const color = scoreColor(score);

  useEffect(() => {
    if (!animate || !ringRef.current || !numRef.current) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(
        ringRef.current,
        { strokeDashoffset: circumference },
        { strokeDashoffset: target, duration: 1.3, ease: "power3.out", delay: 0.15 }
      );
      const counter = { v: 0 };
      gsap.to(counter, {
        v: score,
        duration: 1.3,
        ease: "power3.out",
        delay: 0.15,
        onUpdate: () => {
          if (numRef.current) numRef.current.textContent = counter.v.toFixed(1);
        },
      });
    });
    return () => mm.revert();
  }, [score, animate, circumference, target]);

  return (
    <div
      className="dial"
      style={{ fontSize: size / 6.5 }}
      role="img"
      aria-label={`Match score ${score.toFixed(1)} out of 5`}
    >
      <svg width={size} height={size}>
        <circle
          className="dial-track"
          cx={size / 2} cy={size / 2} r={r}
          fill="none" strokeWidth={stroke}
        />
        <circle
          ref={ringRef}
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate ? circumference : target}
          style={!animate ? undefined : { strokeDashoffset: target }}
        />
      </svg>
      <div className="dial-value">
        <span className="dial-num" ref={numRef} style={{ color }}>
          {score.toFixed(1)}
        </span>
        <div className="dial-outof">/ 5</div>
      </div>
    </div>
  );
}
