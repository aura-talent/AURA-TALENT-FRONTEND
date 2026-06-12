"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import HeroDemo from "@/components/HeroDemo";
import HeroScene, { type HeroSceneApi } from "@/components/HeroScene";

const RING_CIRC = 47.1;
const RING_END = 7.5; // the resting dashoffset of the brand mark

type Phase = "boot" | "zoom" | "text" | "demo";

/**
 * Hero with a boot sequence: the camera starts flush against a monitor
 * in the diorama, showing a porcelain boot screen — the brand ring draws
 * in as a 0→100 counter runs. At 100 the screen lifts, the camera pulls
 * back to reveal the workspace, the copy types up from the bottom-left,
 * and finally the evaluation panel assembles top-right.
 * Reduced motion skips straight to the finished hero.
 */
export default function Hero() {
  const [phase, setPhase] = useState<Phase>("boot");
  const root = useRef<HTMLElement>(null);
  const loader = useRef<HTMLDivElement>(null);
  const ring = useRef<SVGCircleElement>(null);
  const pct = useRef<HTMLSpanElement>(null);
  const sceneApi = useRef<HeroSceneApi | null>(null);

  const handleApi = useCallback((api: HeroSceneApi) => {
    sceneApi.current = api;
  }, []);

  /* boot: counter runs under the overlay, then hands off to the zoom */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setPhase("demo");
      return;
    }

    window.scrollTo(0, 0);
    document.body.style.overflow = "hidden";

    const q = gsap.utils.selector(root);
    gsap.set(q(".hero-copy > *"), { autoAlpha: 0 });
    gsap.set(q(".hero-hud-label"), { autoAlpha: 0 });

    const counter = { v: 0 };
    const tween = gsap.to(counter, {
      v: 100,
      duration: 2,
      ease: "power2.inOut",
      onUpdate: () => {
        if (pct.current) pct.current.textContent = String(Math.floor(counter.v));
        if (ring.current) {
          ring.current.style.strokeDashoffset = String(
            RING_CIRC - ((RING_CIRC - RING_END) * counter.v) / 100
          );
        }
      },
      onComplete: () => {
        setPhase("zoom");
        gsap.to(loader.current, { autoAlpha: 0, duration: 0.6, delay: 0.15 });
        const finish = () => {
          document.body.style.overflow = "";
          setPhase("text");
        };
        if (sceneApi.current) sceneApi.current.zoomOut(finish);
        else finish();
      },
    });

    return () => {
      tween.kill();
      document.body.style.overflow = "";
    };
  }, []);

  /* text: the copy and HUD labels print in, then cue the panel */
  useEffect(() => {
    if (phase !== "text") return;
    const q = gsap.utils.selector(root);
    const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.7 } });
    tl.to(q(".hero-hud-label"), { autoAlpha: 1, duration: 0.5 })
      .fromTo(
        q(".hero-copy > *"),
        { y: 26, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.12 },
        "<"
      )
      /* the panel gets its cue 500ms after the copy starts printing */
      .call(() => setPhase("demo"), [], 0.5);
    return () => {
      tl.kill();
    };
  }, [phase]);

  return (
    <section className="hero" ref={root}>
      <HeroScene intro onApiReady={handleApi} />

      {(phase === "boot" || phase === "zoom") && (
        <div className="intro-loader" ref={loader} aria-hidden="true">
          <span className="intro-loader-label intro-loader-tl">
            AURA_TALENT
            <br />
            BOOT_SEQUENCE
          </span>
          <span className="intro-loader-label intro-loader-br">
            [FIT_ENGINE_V2]
            <br />
            LOADING_MODULES
          </span>
          <div className="intro-loader-center">
            <svg width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
              <defs>
                <linearGradient id="intro-aura" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c7b9ff" />
                  <stop offset="50%" stopColor="#ffd9c2" />
                  <stop offset="100%" stopColor="#bfead8" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="#1a1d29" />
              <circle
                ref={ring}
                cx="16"
                cy="16"
                r="9"
                fill="none"
                stroke="url(#intro-aura)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC}
                transform="rotate(-90 16 16)"
              />
            </svg>
            <div className="intro-pct">
              <span ref={pct}>0</span>%
            </div>
          </div>
        </div>
      )}

      <div className="hero-hud" aria-hidden="true">
        <span className="hero-hud-label hero-hud-tl">
          AURA_TALENT
          <br />
          [FIT_ENGINE_V2]
        </span>
        <span className="hero-hud-label hero-hud-br">
          (DIAGRAM 01)
          <br />
          EVALUATION_READY
        </span>
      </div>
      <div className="hero-copy">
        <h1>Know which jobs deserve you.</h1>
        <p className="hero-sub">
          Aura reads a job post the way a sharp recruiter would — scores your
          real fit, shows what to fix in your resume, and tells you when to
          walk away.
        </p>
        <div className="hero-ctas">
          <Link href="/onboarding" className="btn btn-primary">
            Evaluate your first job
          </Link>
        </div>
        <p className="hero-trust text-xs">
          Built on the open-source{" "}
          <a
            href="https://github.com/santifer/career-ops"
            target="_blank"
            rel="noopener noreferrer"
          >
            career-ops
          </a>{" "}
          engine — 740+ offers evaluated by its author before it landed him
          the job.
        </p>
      </div>
      <div className="hero-demo-float">
        <HeroDemo active={phase === "demo"} />
      </div>
    </section>
  );
}
