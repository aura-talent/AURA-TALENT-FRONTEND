"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

/** Color band for a 0-100 employment rate, mirroring scoreColor's tiers. */
export function rateColor(pct: number): string {
  if (pct >= 90) return "var(--score-strong)";
  if (pct >= 80) return "var(--score-good)";
  if (pct >= 70) return "var(--score-fair)";
  return "var(--score-weak)";
}

/**
 * ScoreDial's sibling for real percentages (0-100): same ring + count-up
 * language, but the number is a published employment rate, not a score.
 * ScoreDial itself stays 1-5-locked; do not merge the two.
 */
export default function PercentDial({
  pct,
  size = 132,
  animate = true,
}: {
  pct: number;
  size?: number;
  animate?: boolean;
}) {
  const ringRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  const stroke = Math.max(6, size / 16);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.min(Math.max(pct, 0), 100);
  const target = circumference * (1 - clamped / 100);
  const color = rateColor(clamped);

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
        v: clamped,
        duration: 1.3,
        ease: "power3.out",
        delay: 0.15,
        onUpdate: () => {
          if (numRef.current) numRef.current.textContent = counter.v.toFixed(1);
        },
      });
    });
    return () => mm.revert();
  }, [clamped, animate, circumference, target]);

  return (
    <div
      className="dial"
      style={{ fontSize: size / 6.5 }}
      role="img"
      aria-label={`Employment rate ${clamped.toFixed(1)} percent`}
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
          {clamped.toFixed(1)}
        </span>
        <div className="dial-outof">% employed</div>
      </div>
    </div>
  );
}
