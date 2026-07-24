"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { AnimalState } from "@/lib/api";
import { ANIMALS, type AnimalId } from "@/lib/animal/animals";
import type { PorcelainScene } from "@/lib/animal/scene";
import styles from "./animal.module.css";

interface Props {
  state: AnimalState;
  scene: PorcelainScene | null;
  reducedMotion: boolean;
  onSettle: () => void;
}

export default function Ceremony({ state, scene, reducedMotion, onSettle }: Props) {
  const [phase, setPhase] = useState<"condensing" | "revealed">("condensing");
  const textRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const meta = ANIMALS[state.animal as AnimalId] ?? ANIMALS.chameleon;

  const settle = () => {
    if (done.current) return;
    done.current = true;
    // text enters only after the zoom-out finishes, never during it
    const glide = scene?.settle();
    if (glide) glide.then(onSettle);
    else onSettle();
  };

  useEffect(() => {
    if (reducedMotion || !scene) {
      settle();
      return;
    }
    let cancelled = false;
    (async () => {
      await scene.condense();
      if (cancelled || done.current) return;
      await scene.revealFigurine(state.animal, state.alignment, state.temperament);
      if (cancelled || done.current) return;
      setPhase("revealed");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done.current) return;
    if (phase !== "revealed" || !textRef.current) return;
    const tl = gsap.timeline();
    tl.fromTo(textRef.current.children, { y: 24, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.7, stagger: 0.35, ease: "power3.out" });
    tl.call(settle, [], "+=2.2");
    return () => { tl.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className={styles.ceremony}>
      {phase === "revealed" && (
        <div ref={textRef} className={styles.ceremonyText}>
          <h1 className={styles.ceremonyHeadline}>
            {state.copy?.headline ?? `You're ${/^[aeiou]/i.test(meta.name) ? "an" : "a"} ${meta.name}. ${meta.emoji}`}
          </h1>
          <p className={styles.ceremonyWhy}>{state.copy?.why ?? meta.niche}</p>
        </div>
      )}
      <button className={`mono ${styles.skipBtn}`} onClick={settle}>
        skip →
      </button>
    </div>
  );
}
