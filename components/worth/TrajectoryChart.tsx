"use client";

import type { FairPayTrajectoryPoint } from "@/lib/api";

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

const W = 560;
const H = 180;
const PAD = { top: 16, right: 56, bottom: 26, left: 8 };

/**
 * Pay trajectory now → +5y as an inline SVG: shaded band envelope
 * (p25–p75) with the point line on top. Numbers are server-computed;
 * dashed styling flags LLM-only estimates.
 */
export default function TrajectoryChart({
  trajectory,
  currency,
  llmOnly = false,
}: {
  trajectory: FairPayTrajectoryPoint[];
  currency: string;
  llmOnly?: boolean;
}) {
  if (trajectory.length < 2) return null;

  const xs = trajectory.map((t) => t.offset_years);
  const maxX = Math.max(...xs);
  const lo = Math.min(...trajectory.map((t) => t.band.p25)) * 0.94;
  const hi = Math.max(...trajectory.map((t) => t.band.p75)) * 1.04;

  const x = (yr: number) => PAD.left + (yr / maxX) * (W - PAD.left - PAD.right);
  const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);

  const line = trajectory.map((t, i) => `${i ? "L" : "M"}${x(t.offset_years)},${y(t.point)}`).join(" ");
  const envelope =
    trajectory.map((t, i) => `${i ? "L" : "M"}${x(t.offset_years)},${y(t.band.p75)}`).join(" ") +
    " " +
    [...trajectory].reverse().map((t) => `L${x(t.offset_years)},${y(t.band.p25)}`).join(" ") +
    " Z";

  return (
    <div className="worth-traj">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projected pay trajectory" style={{ width: "100%", height: "auto", display: "block" }}>
        <path d={envelope} fill="var(--iris-08)" stroke="none" />
        <path
          d={line}
          fill="none"
          stroke="var(--iris)"
          strokeWidth={2}
          strokeDasharray={llmOnly ? "5 4" : undefined}
        />
        {trajectory.map((t) => (
          <g key={t.offset_years}>
            <circle cx={x(t.offset_years)} cy={y(t.point)} r={3.5} fill="var(--iris)" />
            <text
              x={x(t.offset_years)}
              y={y(t.point) - 9}
              textAnchor={t.offset_years === maxX ? "end" : "middle"}
              style={{ font: "600 10px var(--font-space), monospace", fill: "var(--ink)" }}
            >
              {fmt(t.point, currency)}
            </text>
            <text
              x={x(t.offset_years)}
              y={H - 8}
              textAnchor={t.offset_years === 0 ? "start" : t.offset_years === maxX ? "end" : "middle"}
              style={{ font: "10px var(--font-space), monospace", fill: "var(--ink-55)" }}
            >
              {t.offset_years === 0 ? "NOW" : `+${t.offset_years}Y`}
            </text>
          </g>
        ))}
      </svg>
      <div className="worth-traj-notes">
        {trajectory.filter((t) => t.annotation).map((t) => (
          <div key={t.offset_years} className="worth-traj-note">
            <span className="worth-traj-note-yr">{t.offset_years === 0 ? "NOW" : `+${t.offset_years}Y`}</span>
            <span>{t.annotation}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
