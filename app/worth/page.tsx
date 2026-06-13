"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import { api, ApiError, type SelfWorthEstimate } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";

const PERIOD_SUFFIX: Record<SelfWorthEstimate["period"], string> = {
  year: "/yr",
  month: "/mo",
  hour: "/hr",
};

const CONF_LABEL: Record<SelfWorthEstimate["confidence"], string> = {
  high: "HIGH_CONFIDENCE",
  medium: "MEDIUM_CONFIDENCE",
  low: "LOW_CONFIDENCE // DATA_THIN",
};

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

export default function WorthPage() {
  const root = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();

  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noResume, setNoResume] = useState(false);
  const [result, setResult] = useState<SelfWorthEstimate | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("aura_location_filter");
    if (saved) setLocation(saved);
  }, []);

  async function run() {
    setError("");
    setNoResume(false);
    setBusy(true);
    setResult(null);
    try {
      const r = await api.selfWorth(location ? { location } : {});
      setResult(r);
    } catch (e) {
      // 404 = no résumé for this user; guide to onboarding rather than alarm
      if (e instanceof ApiError && e.status === 404) {
        setNoResume(true);
      } else {
        setError("Could not estimate — please try again, or check the backend is running.");
      }
    } finally {
      setBusy(false);
    }
  }

  /* entrance */
  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 }).from(
        q(".worth-form"),
        { y: 24, autoAlpha: 0, duration: 0.65 },
        "-=0.3"
      );
    });
    return () => mm.revert();
  }, []);

  /* result reveal: band sweeps, deltas file in */
  useEffect(() => {
    if (!result) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".worth-result > *"), { y: 20, autoAlpha: 0, stagger: 0.1 })
        .from(
          q(".worth-band-fill"),
          { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "power3.inOut" },
          "-=0.3"
        )
        .from(q(".worth-delta"), { x: -16, autoAlpha: 0, stagger: 0.07 }, "-=0.4");
    });
    return () => mm.revert();
  }, [result]);

  if (!authLoading && !user) {
    return (
      <div className="app-sheet">
        <div className="container" style={{ maxWidth: 680, paddingBottom: "4rem" }}>
          <div className="page-head">
            <div className="page-kicker">(01) // YOUR_WORTH</div>
            <h1>What you&apos;re worth</h1>
            <p>Sign in and upload your resume to see your market band.</p>
          </div>
          <Link href="/login?redirect=/worth" className="btn btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-sheet" ref={root}>
      <div className="container" style={{ maxWidth: 680, paddingBottom: "4rem" }}>
        <div className="page-head">
          <div className="page-kicker">(01) // YOUR_WORTH</div>
          <h1>What you&apos;re worth</h1>
          <p>
            Aura prices your resume against the live market — your band, where
            you sit, and the moves that raise it.
          </p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}
        {noResume && (
          <div className="notice notice-warn">
            No résumé on file for your account yet —{" "}
            <Link href="/onboarding" style={{ fontWeight: 600 }}>
              upload it first
            </Link>{" "}
            so Aura has something to price.
          </div>
        )}

        <div className="panel worth-form">
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label htmlFor="worth-loc">
              Target market{" "}
              <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-55)" }}>
                (optional)
              </span>
            </label>
            <input
              id="worth-loc"
              className="input"
              placeholder="Remote, Singapore, London…"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !busy && run()}
            />
          </div>
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? "Pricing…" : result ? "Recalculate" : "Calculate my worth"}
          </button>
          {busy && (
            <div className="scan-status" style={{ marginTop: "1rem" }}>
              <span className="scan-spinner" />
              PRICING // READING_RESUME × MARKET
            </div>
          )}
        </div>

        {result && (
          <div className="worth-result">
            <div className="panel worth-band-panel">
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />
              <div className="page-kicker" style={{ marginBottom: "0.4rem" }}>
                MARKET_BAND // {result.headline_role.toUpperCase()}
              </div>

              <div className="worth-figure">
                {fmt(result.worth.mid, result.currency)}
                <span className="worth-figure-suffix">
                  {PERIOD_SUFFIX[result.period]} median
                </span>
              </div>

              <div className="worth-ruler">
                <div className="worth-band-fill" />
                <span className="worth-median" />
              </div>
              <div className="worth-ruler-labels">
                <span>{fmt(result.worth.low, result.currency)}</span>
                <span>{fmt(result.worth.high, result.currency)}</span>
              </div>

              {result.total_comp_high && (
                <p className="worth-tc">
                  Total comp ceiling ≈ {fmt(result.total_comp_high, result.currency)}
                  {PERIOD_SUFFIX[result.period]} with bonus/equity
                </p>
              )}

              <p className="worth-summary">{result.summary}</p>

              <div className="sal-footer">
                <span className="sal-conf" data-conf={result.confidence}>
                  <span className="sal-conf-dot" />
                  {CONF_LABEL[result.confidence]}
                </span>
                <span className="sal-source">
                  {result.sources.join(" · ")} // {result.location_basis} // {result.as_of}
                </span>
              </div>
            </div>

            {result.skill_deltas.length > 0 && (
              <div className="panel worth-deltas-panel">
                <div className="page-kicker" style={{ marginBottom: "1rem" }}>
                  LEVERAGE // WHAT_MOVES_THE_NUMBER
                </div>
                <div className="worth-deltas">
                  {result.skill_deltas.map((d) => (
                    <div className="worth-delta" key={d.skill}>
                      <span className="worth-delta-pct">+{d.delta_pct}%</span>
                      <div>
                        <div className="worth-delta-skill">{d.skill}</div>
                        <p className="worth-delta-note">{d.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/onboarding" className="btn btn-ghost" style={{ marginTop: "1.25rem" }}>
                  Update my resume →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
