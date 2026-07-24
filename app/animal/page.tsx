"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { AnimalCard, AnimalState, AnimalSwipePayload } from "@/lib/api";
import { PorcelainScene } from "@/lib/animal/scene";
import SwipeDeck from "@/components/animal/SwipeDeck";
import Ceremony from "@/components/animal/Ceremony";
import ResultsPanel from "@/components/animal/ResultsPanel";

type Phase = "loading" | "deck" | "submitting" | "ceremony" | "results" | "error";

export default function AnimalPage() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<AnimalCard[]>([]);
  const [state, setState] = useState<AnimalState | null>(null);
  const [shortlist, setShortlist] = useState<AnimalCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<PorcelainScene | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  // scene mounts once and persists across phases — one continuous space
  useEffect(() => {
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- matchMedia is browser-only; standard mount-time init
    setReducedMotion(rm);
    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new PorcelainScene(containerRef.current, { reducedMotion: rm });
    }
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // the figurine window is the page top — never enter a phase mid-scroll
  // (browsers restore scroll position on refresh)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase]);

  // results: scrolling shrinks + docks the figurine under the nav (sticky)
  useEffect(() => {
    if (phase !== "results") {
      sceneRef.current?.setDock(0);
      return;
    }
    const onScroll = () => sceneRef.current?.setDock(window.scrollY / 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  // returning users go straight to results; everyone else gets a deck
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await api.animalState();
        if (cancelled) return;
        const list = await api.animalShortlist();
        if (cancelled) return;
        setState(existing);
        setShortlist(list.cards);
        if (cancelled) return;
        await sceneRef.current?.revealFigurine(existing.animal, existing.alignment, existing.temperament);
        if (cancelled) return;
        await sceneRef.current?.settle();
        if (cancelled) return;
        setPhase("results");
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) {
          try {
            const deck = await api.animalDeck();
            if (cancelled) return;
            setCards(deck.cards);
            setPhase("deck");
          } catch {
            if (cancelled) return;
            setError("Couldn't build a deck — is the backend running?");
            setPhase("error");
          }
        } else {
          setError("Couldn't reach the backend.");
          setPhase("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const newDeck = useCallback(async () => {
    setPhase("loading");
    setError(null);
    try {
      const deck = await api.animalDeck();
      setCards(deck.cards);
      setPhase("deck");
    } catch {
      setError("Couldn't build a deck.");
      setPhase("error");
    }
  }, []);

  const onDeckComplete = useCallback(async (swipes: AnimalSwipePayload[]) => {
    setPhase("submitting");
    try {
      const result = await api.animalSwipes(swipes);
      const list = await api.animalShortlist();
      setState(result);
      setShortlist(list.cards);
      if (result.is_new_animal && !reducedMotion) {
        setPhase("ceremony");
      } else {
        await sceneRef.current?.revealFigurine(result.animal, result.alignment, result.temperament);
        await sceneRef.current?.settle();
        setPhase("results");
      }
    } catch {
      setError("Couldn't read your swipes — try again.");
      setPhase("error");
    }
  }, [reducedMotion]);

  return (
    <main style={{ position: "relative", minHeight: "100vh" }}>
      {/* the continuous porcelain space — behind everything, all phases */}
      <div
        ref={containerRef}
        // in results the figurine floats ABOVE the scrolling content (sticky
        // dock); the canvas is transparent + pointer-transparent so it never
        // blocks reading or clicks
        style={{ position: "fixed", inset: 0, zIndex: phase === "results" ? 5 : 0, pointerEvents: "none" }}
        aria-hidden="true"
      />

      <div style={{ position: "relative", zIndex: 1, paddingTop: "5.5rem" }}>
        {phase === "loading" && (
          <p className="mono" style={{ textAlign: "center", color: "var(--ink-55)" }}>
            dealing your deck…
          </p>
        )}

        {phase === "deck" && (
          <>
            <header style={{ textAlign: "center", marginBottom: "1rem", padding: "0 1.5rem" }}>
              <h1 style={{ fontSize: "1.6rem" }}>What are you at work?</h1>
              <p style={{ color: "var(--ink-55)" }}>
                Swipe real roles. Your instincts do the talking.
              </p>
            </header>
            <SwipeDeck cards={cards} onComplete={onDeckComplete} reducedMotion={reducedMotion} />
          </>
        )}

        {phase === "submitting" && (
          <p className="mono" style={{ textAlign: "center", color: "var(--ink-55)" }}>
            reading your instincts…
          </p>
        )}

        {phase === "ceremony" && state && (
          <Ceremony
            state={state}
            scene={sceneRef.current} // eslint-disable-line react-hooks/refs -- scene is created in the mount effect, guaranteed set before this phase renders
            reducedMotion={reducedMotion}
            onSettle={() => setPhase("results")}
          />
        )}

        {phase === "results" && state && (
          <>
            <div style={{ height: "34vh" }} aria-hidden="true" /> {/* figurine window */}
            <ResultsPanel state={state} shortlist={shortlist} scene={sceneRef.current} // eslint-disable-line react-hooks/refs -- scene is created in the mount effect, guaranteed set before this phase renders
            />
            <div style={{ textAlign: "center", paddingBottom: "3rem" }}>
              <button className="btn btn-primary" onClick={newDeck}>
                Swipe a new deck
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ color: "var(--score-weak)" }}>{error}</p>
            <button className="btn" onClick={newDeck} style={{ marginTop: "1rem" }}>
              Retry
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
