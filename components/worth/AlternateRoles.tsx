"use client";

import type { FairPayAlternate } from "@/lib/api";
import SalaryBandBar from "@/components/insights/SalaryBandBar";

/** "If you moved instead" — server-computed bands for adjacent roles at the
 * user's experience level, with the median delta vs their current point. */
export default function AlternateRoles({ alternates }: { alternates: FairPayAlternate[] }) {
  if (alternates.length === 0) return null;
  return (
    <div className="worth-alts">
      {alternates.map((a) => (
        <div className="worth-alt" key={a.role_id}>
          <div className="worth-alt-head">
            <span className="worth-alt-title">{a.title}</span>
            <span className={`worth-alt-delta ${a.delta_pct >= 0 ? "is-up" : "is-down"}`}>
              {a.delta_pct >= 0 ? "+" : ""}
              {a.delta_pct.toFixed(0)}% median
            </span>
          </div>
          <SalaryBandBar band={a.band} compact />
          <p className="worth-alt-note">{a.note}</p>
        </div>
      ))}
    </div>
  );
}
