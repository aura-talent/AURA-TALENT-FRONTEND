"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { api, type Application } from "@/lib/api";
import { scoreColor } from "@/components/ScoreDial";
import Thinking from "@/components/Thinking";
import ReportView from "@/components/ReportView";

export default function ComparePage() {
  const root = useRef<HTMLDivElement>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api
      .listApplications()
      .then(setApps)
      .catch(() => setError("Could not load evaluations — is the backend running?"))
      .finally(() => setLoaded(true));
  }, []);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run() {
    setError("");
    setBusy(true);

    try {
      const r = await api.compare([...selected]);
      setResult(r.comparison_markdown);
    } catch {
      setError("Comparison failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  /* the title block prints once, immediately — no data dependency */
  useEffect(() => {
    const mm = gsap.matchMedia(root);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(gsap.utils.selector(root)(".page-head > *"), {
        y: 22,
        autoAlpha: 0,
        duration: 0.6,
        ease: "power3.out",
        stagger: 0.1,
      });
    });

    return () => mm.revert();
  }, []);

  /* selection content only exists once `loaded`, so this plays on its
     first appearance (and again when returning from a verdict) without
     ever re-animating something already on screen */
  useEffect(() => {
    if (!loaded || busy || result) return;

    const mm = gsap.matchMedia(root);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);

      const tl = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      tl.from(q(".compare-panel"), {
        y: 26,
        autoAlpha: 0,
        duration: 0.65,
      })
        .from(
          q(".compare-row"),
          {
            x: -18,
            autoAlpha: 0,
            duration: 0.45,
            ease: "power2.out",
            stagger: 0.05,
          },
          "-=0.35"
        )
        .from(
          q(".compare-go"),
          {
            y: 14,
            autoAlpha: 0,
            duration: 0.45,
          },
          "-=0.2"
        );
    });

    return () => mm.revert();
  }, [loaded, busy, result]);

  /* verdict: the report sheet rises when the comparison lands */
  useEffect(() => {
    if (!result) return;

    const mm = gsap.matchMedia(root);

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from(gsap.utils.selector(root)(".compare-report"), {
        y: 30,
        autoAlpha: 0,
        duration: 0.7,
        ease: "power3.out",
      });
    });

    return () => mm.revert();
  }, [result]);

  if (busy) {
    return (
      <div className="app-sheet" ref={root}>
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="page-head">
            <div className="page-kicker">COMPARISON_AGENT // RUNNING</div>
            <h1>Comparing</h1>
          </div>

          <div className="panel">
            <Thinking
              lines={[
                "Lining up your offers…",
                "Weighing trajectory against compensation…",
                "Writing the verdict…",
              ]}
            />
          </div>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="app-sheet" ref={root}>
        <div
          className="container"
          style={{ maxWidth: 820, paddingBottom: "4rem" }}
        >
          <div className="page-head">
            <div className="page-kicker">(02) // HEAD_TO_HEAD</div>
            <h1>Head to head</h1>
          </div>

          <div
            className="panel compare-report"
            style={{ marginBottom: "1.5rem" }}
          >
            <ReportView markdown={result} />
          </div>

          <button
            className="btn btn-primary"
            onClick={() => {
              setResult(null);
              setSelected(new Set());
            }}
          >
            Compare different jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-sheet" ref={root}>
      <div
        className="container"
        style={{ maxWidth: 760, paddingBottom: "4rem" }}
      >
        <div className="page-head">
          <div className="page-kicker">(01) // SELECTION</div>
          <h1>Compare offers</h1>

          <p>
            Pick two or more evaluated jobs. Aura ranks them and tells you
            where to focus — and what to drop.
          </p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        {!loaded ? (
          <div className="scan-status">
            <span className="scan-spinner" aria-hidden="true" />
            <span>LOADING_EVALUATIONS // RUNNING</span>
          </div>
        ) : apps.length < 2 ? (
          <div
            className="panel compare-panel"
            style={{
              textAlign: "center",
              padding: "3.5rem 1.5rem",
            }}
          >
            <h3 style={{ marginBottom: "0.6rem" }}>
              You need at least two evaluations
            </h3>

            <p
              style={{
                color: "var(--ink-72)",
                marginBottom: "1.5rem",
              }}
            >
              Evaluate a couple of jobs first, then come back to rank them.
            </p>

            <Link href="/evaluate" className="btn btn-primary">
              Evaluate a job
            </Link>
          </div>
        ) : (
          <>
            <div
              className="panel compare-panel"
              style={{ marginBottom: "1.25rem" }}
            >
              {apps.map((a) => (
                <label
                  className="compare-row"
                  key={a.evaluation_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.9rem",
                    padding: "0.8rem 0.4rem",
                    borderBottom: "1px dashed var(--ink-12)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(a.evaluation_id)}
                    onChange={() => toggle(a.evaluation_id)}
                    style={{
                      width: 18,
                      height: 18,
                      accentColor: "var(--iris)",
                    }}
                  />

                  <span
                    className="score-pill"
                    style={{
                      background: scoreColor(a.score),
                    }}
                  >
                    {a.score.toFixed(1)}
                  </span>

                  <span style={{ fontWeight: 600 }}>
                    {a.company}
                  </span>

                  <span style={{ color: "var(--ink-72)" }}>
                    {a.role}
                  </span>
                </label>
              ))}
            </div>

            <button
              className="btn btn-primary compare-go"
              disabled={selected.size < 2}
              onClick={run}
            >
              Compare{" "}
              {selected.size >= 2
                ? `${selected.size} jobs`
                : "selected"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}