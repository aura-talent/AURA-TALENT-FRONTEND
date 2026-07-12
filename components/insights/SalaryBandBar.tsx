"use client";

import type { EmployabilitySalaryBand } from "@/lib/api";

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

const PERIOD_SUFFIX: Record<string, string> = { month: "/mo", year: "/yr" };

/**
 * A published P25 → P75 salary band as a horizontal bar with the median
 * marked. Pure presentation — numbers come straight from the dataset.
 */
export default function SalaryBandBar({
  band,
  compact = false,
}: {
  band: EmployabilitySalaryBand;
  compact?: boolean;
}) {
  // position the bar inside a padded domain so the band never touches the edges
  const lo = band.p25 * 0.82;
  const hi = band.p75 * 1.12;
  const pos = (v: number) => `${(((v - lo) / (hi - lo)) * 100).toFixed(1)}%`;
  const width = `${(((band.p75 - band.p25) / (hi - lo)) * 100).toFixed(1)}%`;
  const suffix = PERIOD_SUFFIX[band.period] ?? `/${band.period}`;

  return (
    <div style={{ width: "100%" }}>
      <div
        role="img"
        aria-label={`Salary ${band.currency} ${fmt(band.p25)} to ${fmt(band.p75)}${suffix}${band.p50 !== null ? `, median ${fmt(band.p50)}` : ""}`}
        style={{
          position: "relative",
          height: compact ? 8 : 12,
          borderRadius: 99,
          background: "var(--ink-06)",
          border: "1px solid var(--ink-12)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: pos(band.p25),
            width,
            borderRadius: 99,
            background: "linear-gradient(90deg, var(--aura-a), var(--iris))",
            opacity: 0.85,
          }}
        />
        {band.p50 !== null && (
          <div
            style={{
              position: "absolute",
              top: compact ? -3 : -4,
              bottom: compact ? -3 : -4,
              left: pos(band.p50),
              width: 2.5,
              borderRadius: 2,
              background: "var(--ink)",
            }}
          />
        )}
      </div>
      {!compact && (
        <div
          className="mono"
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 7,
            fontSize: "0.7rem",
            color: "var(--ink-55)",
            letterSpacing: "0.04em",
          }}
        >
          <span>
            {band.currency} {fmt(band.p25)}
          </span>
          <span style={{ color: "var(--ink)", fontWeight: 600 }}>
            {band.p50 !== null
              ? `median ${band.currency} ${fmt(band.p50)}${suffix}`
              : `published range${suffix}`}
          </span>
          <span>
            {band.currency} {fmt(band.p75)}
          </span>
        </div>
      )}
    </div>
  );
}
