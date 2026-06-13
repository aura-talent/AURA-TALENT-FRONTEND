"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import type { SalaryEstimate } from "@/lib/api";

/**
 * Compensation analysis as a calibration ruler: role-worth band, the
 * posted range, and the candidate's own worth all plotted on one axis so
 * the gap is visible, not just stated. Blueprint aesthetic — ink rule,
 * iris fill, mono figures, with a confidence/source footer for honesty.
 */

const CONF_LABEL: Record<SalaryEstimate["confidence"], string> = {
  high: "HIGH_CONFIDENCE",
  medium: "MEDIUM_CONFIDENCE",
  low: "LOW_CONFIDENCE // DATA_THIN",
};

const GAP_COPY: Record<NonNullable<SalaryEstimate["gap"]>["verdict"], { label: string; color: string }> = {
  below: { label: "BELOW_MARKET", color: "var(--score-weak)" },
  fair: { label: "FAIR", color: "var(--score-strong)" },
  above: { label: "ABOVE_MARKET", color: "var(--score-fair)" },
};

function fmt(n: number, currency: string): string {
  // compact, currency-aware, no cents — "$118K", "RM 9.2K"
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

const PERIOD_SUFFIX: Record<SalaryEstimate["period"], string> = {
  year: "/yr",
  month: "/mo",
  hour: "/hr",
};

export default function SalaryPanel({ salary }: { salary: SalaryEstimate }) {
  const root = useRef<HTMLDivElement>(null);

  // domain across every figure present, padded 8% each side
  const values: number[] = [salary.role_worth.low, salary.role_worth.high];
  if (salary.candidate_worth) values.push(salary.candidate_worth.low, salary.candidate_worth.high);
  if (salary.posted?.low != null) values.push(salary.posted.low);
  if (salary.posted?.high != null) values.push(salary.posted.high);
  if (salary.negotiation) values.push(salary.negotiation.anchor);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const pad = (rawMax - rawMin) * 0.08 || rawMax * 0.08 || 1;
  const min = rawMin - pad;
  const max = rawMax + pad;
  const pct = (n: number) => `${((n - min) / (max - min)) * 100}%`;

  const gap = salary.gap ? GAP_COPY[salary.gap.verdict] : null;

  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".sal-row"), { autoAlpha: 0, x: -12, stagger: 0.12 })
        .from(
          q(".sal-band-fill"),
          { scaleX: 0, transformOrigin: "left center", duration: 0.9, ease: "power3.inOut" },
          "-=0.3"
        )
        .from(q(".sal-marker"), { autoAlpha: 0, y: 6, stagger: 0.1 }, "-=0.5");
    });
    return () => mm.revert();
  }, []);

  return (
    <div className="panel sal-panel" ref={root}>
      <span className="eval-tick eval-tick-tl" />
      <span className="eval-tick eval-tick-tr" />
      <span className="eval-tick eval-tick-bl" />
      <span className="eval-tick eval-tick-br" />

      <div className="page-kicker" style={{ marginBottom: "1rem" }}>
        COMP_ANALYSIS // BASE_SALARY
      </div>

      {/* the ruler */}
      <div className="sal-ruler">
        {/* role-worth band */}
        <div
          className="sal-band-fill"
          style={{ left: pct(salary.role_worth.low), right: `calc(100% - ${pct(salary.role_worth.high)})` }}
        />
        <span className="sal-median" style={{ left: pct(salary.role_worth.mid) }} />

        {/* posted range bracket */}
        {salary.posted?.low != null && salary.posted?.high != null && (
          <div
            className="sal-posted"
            style={{ left: pct(salary.posted.low), right: `calc(100% - ${pct(salary.posted.high)})` }}
          />
        )}

        {/* candidate-worth marker */}
        {salary.candidate_worth && (
          <span className="sal-marker sal-you" style={{ left: pct(salary.candidate_worth.mid) }}>
            <span className="sal-marker-label">YOU</span>
          </span>
        )}

        {/* negotiation anchor */}
        {salary.negotiation && (
          <span className="sal-marker sal-anchor" style={{ left: pct(salary.negotiation.anchor) }}>
            <span className="sal-marker-label">ASK</span>
          </span>
        )}
      </div>

      {/* legend rows */}
      <div className="sal-rows">
        <div className="sal-row">
          <span className="sal-swatch sal-swatch-role" />
          <span className="sal-row-label">Role worth</span>
          <span className="sal-row-val">
            {fmt(salary.role_worth.low, salary.currency)}–{fmt(salary.role_worth.high, salary.currency)}
            {PERIOD_SUFFIX[salary.period]}
          </span>
        </div>

        {salary.posted?.low != null && salary.posted?.high != null && (
          <div className="sal-row">
            <span className="sal-swatch sal-swatch-posted" />
            <span className="sal-row-label">Posted</span>
            <span className="sal-row-val">
              {fmt(salary.posted.low, salary.currency)}–{fmt(salary.posted.high, salary.currency)}
              {gap && (
                <span className="sal-gap" style={{ color: gap.color }}>
                  {" "}
                  {gap.label} {salary.gap!.delta_pct > 0 ? "+" : ""}
                  {salary.gap!.delta_pct}%
                </span>
              )}
            </span>
          </div>
        )}

        {salary.candidate_worth && (
          <div className="sal-row">
            <span className="sal-swatch sal-swatch-you" />
            <span className="sal-row-label">You&apos;re worth</span>
            <span className="sal-row-val">
              {fmt(salary.candidate_worth.low, salary.currency)}–{fmt(salary.candidate_worth.high, salary.currency)}
              {PERIOD_SUFFIX[salary.period]}
            </span>
          </div>
        )}
      </div>

      {salary.gap?.note && <p className="sal-note">{salary.gap.note}</p>}

      {salary.negotiation && (
        <div className="sal-negotiation">
          <div className="sal-neg-head">
            ANCHOR @ {fmt(salary.negotiation.anchor, salary.currency)}
            {PERIOD_SUFFIX[salary.period]}
          </div>
          <p>{salary.negotiation.line}</p>
        </div>
      )}

      <div className="sal-footer">
        <span className="sal-conf" data-conf={salary.confidence}>
          <span className="sal-conf-dot" />
          {CONF_LABEL[salary.confidence]}
        </span>
        <span className="sal-source">
          {salary.sources.join(" · ")} // {salary.location_basis} // {salary.as_of}
        </span>
      </div>
    </div>
  );
}
