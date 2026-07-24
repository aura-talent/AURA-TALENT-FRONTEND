"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type EmployabilityDataset, type EmployabilityUniversity } from "@/lib/api";

export interface UniSelection {
  id: string;
  name: string;
}

/** Average of a uni's per-degree employment rates (SG unis report per-degree,
 * so there's no single uni-level rate). */
function degreeAvgRate(u: EmployabilityUniversity): number | null {
  const rates = u.degrees.map((d) => d.employment_rate_pct).filter((r): r is number => r != null);
  if (!rates.length) return null;
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

export default function UniversityTiles({
  country,
  selectedId,
  onSelect,
}: {
  country: "SG" | "MY";
  selectedId?: string | null;
  onSelect?: (u: UniSelection) => void;
}) {
  const [dataset, setDataset] = useState<EmployabilityDataset | null>(null);

  useEffect(() => {
    api.employabilityDataset().then(setDataset).catch(() => {});
  }, []);

  const unis = useMemo(
    () =>
      (dataset?.universities ?? [])
        .filter((u) => u.country === country)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name)),
    [dataset, country]
  );

  if (!dataset) {
    return (
      <p className="mono" style={{ color: "var(--ink-55)", fontSize: "0.78rem" }}>
        Loading universities…
      </p>
    );
  }
  if (!unis.length) {
    return (
      <p className="mono" style={{ color: "var(--ink-55)", fontSize: "0.78rem" }}>
        No universities tracked for {country} yet.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
        gap: "0.75rem",
      }}
    >
      {unis.map((u) => {
        const rate = u.employment_rate_pct ?? degreeAvgRate(u);
        const sel = selectedId === u.id;
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => onSelect?.({ id: u.id, name: u.name })}
            className={`group flex flex-col gap-2 min-h-[96px] text-left px-4 py-3 cursor-pointer border transition-[border-color,background-color] duration-200 ${
              sel
                ? "border-[color:var(--iris)] bg-[var(--iris-08)]"
                : "border-[color:var(--ink-30)] bg-[var(--surface)] hover:border-[color:var(--iris)] hover:bg-[var(--iris-08)]"
            }`}
          >
            <span className="font-[family-name:var(--font-space)] font-bold text-[0.82rem] leading-tight text-[color:var(--ink)]">
              {u.name}
            </span>
            <span className="font-[family-name:var(--font-space)] text-[0.66rem] tracking-[0.04em] uppercase text-[color:var(--ink-55)] mt-auto">
              {rate != null
                ? `${rate.toFixed(1)}% employed`
                : `${u.degrees.length} field${u.degrees.length === 1 ? "" : "s"} tracked`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
