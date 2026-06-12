"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Scroll-triggered reveal. Children marked [data-reveal] rise in with a
 * stagger when the wrapper enters the viewport. With reduced motion (or
 * no JS) everything simply renders in place — the animation only ever
 * *adds* motion, it never hides content from non-animating visitors.
 */
const VARIANTS = {
  /* sections that are a sequence rise in order */
  rise: { y: 28, autoAlpha: 0 },
  /* index rows slide in from the left margin, like entries being filed */
  row: { x: -32, autoAlpha: 0 },
} as const;

export default function Reveal({
  children,
  as: Tag = "div",
  className,
  id,
  variant = "rise",
}: {
  children: React.ReactNode;
  as?: "div" | "section";
  className?: string;
  id?: string;
  variant?: keyof typeof VARIANTS;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.registerPlugin(ScrollTrigger);
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const targets = ref.current!.querySelectorAll("[data-reveal]");
      if (targets.length) {
        gsap.from(targets, {
          ...VARIANTS[variant],
          duration: 0.75,
          ease: "power3.out",
          stagger: variant === "row" ? 0.06 : 0.09,
          scrollTrigger: { trigger: ref.current, start: "top 78%" },
        });
      }
      /* hairline rules draft themselves in, left to right */
      const lines = ref.current!.querySelectorAll("[data-reveal-line]");
      if (lines.length) {
        gsap.from(lines, {
          scaleX: 0,
          transformOrigin: "left center",
          duration: 1.1,
          ease: "power3.inOut",
          stagger: 0.15,
          scrollTrigger: { trigger: ref.current, start: "top 78%" },
        });
      }
    });
    return () => mm.revert();
  }, [variant]);

  return (
    <Tag ref={ref as React.Ref<HTMLDivElement & HTMLElement>} className={className} id={id}>
      {children}
    </Tag>
  );
}
