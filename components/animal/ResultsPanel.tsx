"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { AnimalCard, AnimalState } from "@/lib/api";
import { ANIMALS, AXES_META, TEMPERAMENTS, type AnimalId } from "@/lib/animal/animals";
import type { PorcelainScene } from "@/lib/animal/scene";
import styles from "./animal.module.css";

interface Props {
  state: AnimalState;
  shortlist: AnimalCard[];
  scene: PorcelainScene | null;
}

export default function ResultsPanel({ state, shortlist, scene }: Props) {
  const meta = ANIMALS[state.animal as AnimalId] ?? ANIMALS.chameleon;
  const temp = TEMPERAMENTS[state.temperament] ?? TEMPERAMENTS.decisive;
  const rootRef = useRef<HTMLElement>(null);

  // Staggered fade-up on entry; content is never hidden under reduced motion.
  useEffect(() => {
    if (!rootRef.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.fromTo(
      Array.from(rootRef.current.children),
      { y: 26, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.65, stagger: 0.12, ease: "power3.out", clearProps: "all" }
    );
    return () => { tween.kill(); };
  }, []);

  const download = () => {
    if (!scene) return;
    const a = document.createElement("a");
    a.href = scene.snapshot();
    a.download = `aura-${state.animal}.png`;
    a.click();
  };

  return (
    <section className={styles.results} ref={rootRef}>
      <header className={styles.resultsHead}>
        <div>
          <p className="mono" style={{ color: "var(--ink-55)" }}>
            YOUR_WORK_ANIMAL · {state.swipe_count} swipes read
          </p>
          <h2>
            {meta.emoji} {meta.name}
            <span className={styles.tempBadge}>{temp.label}</span>
          </h2>
          <p className={styles.niche}>{meta.niche}</p>
          {state.copy && <p className={styles.why}>{state.copy.why}</p>}
        </div>
        <button className={`mono ${styles.snapBtn}`} onClick={download} disabled={!scene}>
          ↓ save card
        </button>
      </header>

      <div className={styles.traitGrid}>
        {AXES_META.map(({ key, left, right }) => {
          const v = state.vector[key]; // -1..1 → 0..100%
          return (
            <div key={key} className={styles.traitRow}>
              <span className={`mono ${styles.pole}`}>{left}</span>
              <div className={styles.track}>
                <div className={styles.marker} style={{ left: `${((v + 1) / 2) * 100}%` }} />
              </div>
              <span className={`mono ${styles.pole}`}>{right}</span>
            </div>
          );
        })}
      </div>

      {state.alignment != null && (
        <div className={styles.alignBox}>
          <div className={styles.alignHead}>
            <span className="mono">ALIGNMENT_WITH_YOUR_STATED_GOALS</span>
            <strong>{state.alignment}/100</strong>
          </div>
          <div className={styles.alignTrack}>
            <div className={styles.alignFill} style={{ width: `${state.alignment}%` }} />
          </div>
          {state.copy?.play && <p className={styles.play}>▸ {state.copy.play}</p>}
        </div>
      )}

      <div className={styles.shortlist}>
        <h3>Your shortlist ({shortlist.length})</h3>
        <p className={styles.shortlistNote}>
          Saved, not applied — run each through a full evaluation first.
        </p>
        {shortlist.length === 0 && (
          <p style={{ color: "var(--ink-55)" }}>Nothing saved this round — swipe again anytime.</p>
        )}
        <ul>
          {shortlist.map((c) => (
            <li key={c.id} className={styles.shortRow}>
              <div>
                <p className="mono" style={{ color: "var(--iris)" }}>{c.company}</p>
                <p>{c.title}</p>
              </div>
              <Link
                className={styles.evalLink}
                href={`/evaluate?url=${encodeURIComponent(c.url)}`}
              >
                Evaluate →
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
