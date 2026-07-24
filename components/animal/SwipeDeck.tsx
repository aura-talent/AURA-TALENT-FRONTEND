"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import type { AnimalCard, AnimalSwipePayload } from "@/lib/api";
import { createMannerTracker } from "@/lib/animal/manner";
import { topTraitChips } from "@/lib/animal/animals";
import styles from "./animal.module.css";

interface Props {
  cards: AnimalCard[];
  onComplete: (swipes: AnimalSwipePayload[]) => void;
  reducedMotion: boolean;
}

const FLY_THRESHOLD = 110;

export default function SwipeDeck({ cards, onComplete, reducedMotion }: Props) {
  const [index, setIndex] = useState(0);
  const swipesRef = useRef<AnimalSwipePayload[]>([]);
  const tracker = useMemo(() => createMannerTracker(), []);
  const topRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const busy = useRef(false);
  const done = useRef(false);

  useEffect(() => {
    if (index < cards.length) tracker.cardShown();
  }, [index, cards.length, tracker]);

  const commit = useCallback(
    (direction: "left" | "right") => {
      if (done.current || busy.current || index >= cards.length) return;
      busy.current = true;
      const card = cards[index];
      const manner = tracker.commit();
      swipesRef.current.push({ card, direction, ...manner });
      const isLast = index + 1 >= cards.length;
      const advance = () => {
        if (isLast) {
          done.current = true;
          onComplete(swipesRef.current);
        } else {
          busy.current = false;
          setIndex((i) => i + 1);
        }
      };
      const el = topRef.current;
      if (!el || reducedMotion) return advance();
      gsap.to(el, {
        x: direction === "right" ? window.innerWidth : -window.innerWidth,
        rotation: direction === "right" ? 24 : -24,
        opacity: 0,
        duration: 0.45,
        ease: "power2.in",
        onComplete: () => {
          if (!isLast) gsap.set(el, { x: 0, y: 0, rotation: 0, opacity: 1 });
          advance();
        },
      });
    },
    [cards, index, onComplete, reducedMotion, tracker]
  );

  // keyboard: left = pass, right = save
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") commit("left");
      if (e.key === "ArrowRight") commit("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commit]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (reducedMotion || busy.current) return;
    dragging.current = true;
    start.current = { x: e.clientX, y: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !topRef.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;
    tracker.drag(dx);
    gsap.set(topRef.current, { x: dx, y: dy * 0.4, rotation: dx / 18 });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging.current || !topRef.current) return;
    dragging.current = false;
    const dx = e.clientX - start.current.x;
    if (dx > FLY_THRESHOLD) commit("right");
    else if (dx < -FLY_THRESHOLD) commit("left");
    else gsap.to(topRef.current, { x: 0, y: 0, rotation: 0, duration: 0.35, ease: "elastic.out(1,0.6)" });
  };
  const onPointerCancel = () => {
    if (!dragging.current || !topRef.current) return;
    dragging.current = false;
    gsap.to(topRef.current, { x: 0, y: 0, rotation: 0, duration: 0.35, ease: "elastic.out(1,0.6)" });
  };

  if (index >= cards.length) return null;
  const visible = cards.slice(index, index + 3);

  return (
    <div className={styles.deckWrap}>
      <p className={`mono ${styles.deckProgress}`}>
        {index + 1} / {cards.length}
      </p>
      <div className={styles.deckStack}>
        {visible.map((card, i) => (
          <div
            key={card.id}
            ref={i === 0 ? topRef : undefined}
            className={styles.card}
            style={{
              zIndex: 3 - i,
              transform: `translateY(${i * 14}px) translateZ(${-i * 60}px) scale(${1 - i * 0.05})`,
            }}
            onPointerDown={i === 0 ? onPointerDown : undefined}
            onPointerMove={i === 0 ? onPointerMove : undefined}
            onPointerUp={i === 0 ? onPointerUp : undefined}
            onPointerCancel={i === 0 ? onPointerCancel : undefined}
          >
            <p className={`mono ${styles.cardCompany}`}>{card.company}</p>
            <h3 className={styles.cardTitle}>{card.title}</h3>
            {card.location && <p className={styles.cardLoc}>{card.location}</p>}
            <div className={styles.chips}>
              {topTraitChips(card.traits).map((c) => (
                <span key={c} className={styles.chip}>{c}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.deckActions}>
        <button className={styles.passBtn} onClick={() => commit("left")} aria-label="Pass">
          ✕ Pass
        </button>
        <button className={styles.saveBtn} onClick={() => commit("right")} aria-label="Save to shortlist">
          ♥ Save
        </button>
      </div>
      <p className={`mono ${styles.hint}`}>drag, tap, or use ← →&nbsp;&nbsp;·&nbsp;&nbsp;save ≠ apply — you evaluate later</p>
    </div>
  );
}
