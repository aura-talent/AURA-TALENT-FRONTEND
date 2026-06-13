"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useStream } from "@/lib/useStream";
import StreamProgress from "@/components/StreamProgress";
import { scoreColor } from "@/components/ScoreDial";
import type { CareerMove, CareerPathOut, CareerRoute } from "@/lib/api";

const FALLBACK_LINES = [
  "Gathering your resume and evaluation history…",
  "Mapping realistic career routes…",
  "Composing your career path…",
];

/* effort badge → color (low = easy/green, high = heavy/orange) */
function effortColor(effort: string): string {
  switch (effort.toLowerCase()) {
    case "low":
      return "var(--score-strong)";
    case "medium":
      return "var(--score-fair)";
    case "high":
      return "var(--score-weak)";
    default:
      return "var(--ink-72)";
  }
}

function MoveRow({ move }: { move: CareerMove }) {
  return (
    <div
      style={{
        padding: "0.6rem 0.7rem",
        border: "1px solid var(--ink-30)",
        borderRadius: "var(--r-s)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
        <span
          className="page-kicker"
          style={{
            fontSize: "0.6rem",
            color: "var(--iris)",
            background: "var(--iris-08)",
            border: "1px solid var(--iris-12)",
            borderRadius: "var(--r-s)",
            padding: "0.08rem 0.4rem",
          }}
        >
          {move.category}
        </span>
        <span
          className="mono"
          style={{
            fontSize: "0.62rem",
            color: effortColor(move.effort),
            border: `1px solid ${effortColor(move.effort)}`,
            borderRadius: "var(--r-s)",
            padding: "0.04rem 0.4rem",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {move.effort} effort
        </span>
        <span
          className="mono"
          style={{
            fontSize: "0.62rem",
            color: "var(--ink-72)",
            border: "1px solid var(--ink-30)",
            borderRadius: "var(--r-s)",
            padding: "0.04rem 0.4rem",
          }}
        >
          {move.timeframe}
        </span>
      </div>
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink-92, var(--ink-72))" }}>
        {move.action}
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--ink-55)" }}>{move.why}</div>
    </div>
  );
}

/* compact 1–5 fit meter — five segments lit up to the route's fit */
function FitMeter({ fit }: { fit: number }) {
  const color = scoreColor(fit);
  const lit = Math.round(Math.min(Math.max(fit, 0), 5));
  return (
    <div
      className="cpn-fit"
      role="img"
      aria-label={`Fit ${fit.toFixed(1)} out of 5`}
      title={`Fit ${fit.toFixed(1)} / 5`}
    >
      <div className="cpn-fit-bar" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className="cpn-fit-seg"
            style={{ background: i < lit ? color : "var(--ink-12, rgba(26,29,41,0.12))" }}
          />
        ))}
      </div>
      <span className="cpn-fit-num mono" style={{ color }}>
        {fit.toFixed(1)}
      </span>
    </div>
  );
}

function RouteCard({ route, recommended }: { route: CareerRoute; recommended: boolean }) {
  return (
    <div
      className="dash-job cpn-route"
      style={{
        padding: "1rem",
        border: recommended ? "1.5px solid var(--iris)" : "1px solid var(--ink-30)",
        background: recommended ? "var(--iris-08)" : "var(--surface)",
        borderRadius: "var(--r-s)",
        position: "relative",
      }}
    >
      {recommended && (
        <span
          className="page-kicker"
          style={{
            position: "absolute",
            top: "-0.6rem",
            left: "1rem",
            background: "var(--iris)",
            color: "#fff",
            padding: "0.1rem 0.5rem",
            borderRadius: "var(--r-s)",
            fontSize: "0.62rem",
          }}
        >
          RECOMMENDED
        </span>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "0.75rem",
          marginBottom: "0.4rem",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "1rem" }}>{route.title}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-55)" }}>{route.archetype}</div>
        </div>
        <FitMeter fit={route.fit} />
      </div>

      <span
        className="mono"
        style={{
          display: "inline-block",
          fontSize: "0.68rem",
          color: "var(--ink-72)",
          border: "1px solid var(--ink-30)",
          borderRadius: "var(--r-s)",
          padding: "0.1rem 0.45rem",
          marginBottom: "0.6rem",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {route.time_horizon}
      </span>

      <p style={{ fontSize: "0.85rem", color: "var(--ink-72)", margin: "0 0 0.75rem" }}>
        {route.rationale}
      </p>

      {route.skill_gaps.length > 0 && (
        <div style={{ marginBottom: "0.6rem" }}>
          <div className="page-kicker" style={{ fontSize: "0.62rem", marginBottom: "0.35rem" }}>
            SKILL GAPS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {route.skill_gaps.map((gap) => (
              <span
                key={gap}
                style={{
                  fontSize: "0.74rem",
                  color: "var(--score-fair)",
                  background: "rgba(185, 125, 20, 0.08)",
                  border: "1px solid rgba(185, 125, 20, 0.2)",
                  borderRadius: "var(--r-s)",
                  padding: "0.12rem 0.5rem",
                }}
              >
                {gap}
              </span>
            ))}
          </div>
        </div>
      )}

      {route.moves.length > 0 && (
        <div>
          <div className="page-kicker" style={{ fontSize: "0.62rem", marginBottom: "0.45rem" }}>
            TACTICAL MOVES
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {route.moves.map((move, i) => (
              <MoveRow key={i} move={move} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CareerPathNavigator() {
  const root = useRef<HTMLDivElement>(null);
  const [goal, setGoal] = useState("");
  const [horizon, setHorizon] = useState("");

  const { run, progress, result, error, loading } = useStream<
    CareerPathOut,
    { goal?: string; horizon?: string }
  >("career/path/stream");

  function handleRun() {
    run({
      ...(goal.trim() ? { goal: goal.trim() } : {}),
      ...(horizon.trim() ? { horizon: horizon.trim() } : {}),
    });
  }

  /* routes file in as the result lands */
  useEffect(() => {
    if (!result?.routes?.length) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(gsap.utils.selector(root)(".cpn-route"), {
        y: 16,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power2.out",
        stagger: 0.08,
      });
    });
    return () => mm.revert();
  }, [result]);

  const showForm = !loading && !result;

  return (
    <div className="panel" ref={root} style={{ marginTop: "2rem", position: "relative" }}>
      <span className="eval-tick eval-tick-tl" />
      <span className="eval-tick eval-tick-tr" />
      <span className="eval-tick eval-tick-bl" />
      <span className="eval-tick eval-tick-br" />

      <div className="page-kicker" style={{ marginBottom: "0.6rem" }}>
        NAVIGATOR // CAREER_PATH
      </div>
      <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem", position: "relative", zIndex: 1 }}>
        Career Path Navigator
      </h3>
      <p
        style={{
          fontSize: "0.85rem",
          color: "var(--ink-55)",
          marginBottom: "1.25rem",
          position: "relative",
          zIndex: 1,
          maxWidth: "56ch",
        }}
      >
        Shows you the career routes you could realistically take from where you are now. Built on
        your actual data — resume plus every job you&apos;ve evaluated — not just instinct.
      </p>

      {showForm && (
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
              alignItems: "flex-end",
            }}
          >
            <div className="field" style={{ margin: 0, flex: "2 1 16rem" }}>
              <label
                htmlFor="cpn-goal"
                style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-55)", marginBottom: "0.25rem" }}
              >
                Your aspiration (optional)
              </label>
              <input
                id="cpn-goal"
                className="input"
                style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                placeholder="e.g. Lead an applied AI team"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0, flex: "1 1 9rem" }}>
              <label
                htmlFor="cpn-horizon"
                style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--ink-55)", marginBottom: "0.25rem" }}
              >
                Planning horizon (optional)
              </label>
              <input
                id="cpn-horizon"
                className="input"
                style={{ padding: "0.4rem 0.6rem", fontSize: "0.85rem" }}
                placeholder="e.g. 2 years"
                value={horizon}
                onChange={(e) => setHorizon(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary text-white" onClick={handleRun}>
            Map my career paths
          </button>
        </div>
      )}

      {loading && (
        <div style={{ position: "relative", zIndex: 1 }}>
          <StreamProgress
            title="Mapping your career paths"
            progress={progress}
            fallbackLines={FALLBACK_LINES}
          />
        </div>
      )}

      {error && (
        <div
          className="notice notice-error"
          style={{ position: "relative", zIndex: 1, marginTop: "1rem" }}
        >
          {error === "Upload a resume first"
            ? "Upload your resume first so the Navigator has something to work from."
            : error}
        </div>
      )}

      {result && (
        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              fontSize: "0.9rem",
              color: "var(--ink-72)",
              lineHeight: 1.55,
              marginBottom: "0.75rem",
              paddingBottom: "1rem",
              borderBottom: "1px dashed var(--ink-30)",
            }}
          >
            {result.current_assessment}
          </p>

          {result.first_move && (
            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                alignItems: "flex-start",
                background: "var(--iris-08)",
                border: "1.5px solid var(--iris)",
                borderRadius: "var(--r-s)",
                padding: "0.85rem 1rem",
                marginBottom: "1rem",
              }}
            >
              <span aria-hidden="true" style={{ fontSize: "1.1rem", lineHeight: 1.3 }}>
                ⚡
              </span>
              <div style={{ minWidth: 0 }}>
                <div
                  className="page-kicker"
                  style={{ fontSize: "0.62rem", color: "var(--iris)", marginBottom: "0.2rem" }}
                >
                  DO THIS FIRST
                </div>
                <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--ink-72)" }}>
                  {result.first_move}
                </p>
              </div>
            </div>
          )}

          {result.evaluations_considered === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--score-fair)", marginBottom: "1rem" }}>
              These routes and moves are based on your resume alone. Evaluate a few jobs to make them sharper.
            </p>
          ) : (
            <p style={{ fontSize: "0.78rem", color: "var(--ink-55)", marginBottom: "1rem" }}>
              Grounded in {result.evaluations_considered}{" "}
              {result.evaluations_considered === 1 ? "evaluation" : "evaluations"} plus your resume.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {result.routes.map((route) => (
              <RouteCard
                key={route.title}
                route={route}
                recommended={route.title === result.recommended_route}
              />
            ))}
          </div>

          <button
            className="btn btn-ghost"
            style={{ marginTop: "1.25rem", fontSize: "0.8rem" }}
            onClick={handleRun}
          >
            Re-map paths
          </button>
        </div>
      )}
    </div>
  );
}
