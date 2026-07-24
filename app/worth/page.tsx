"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  api,
  ApiError,
  type SelfWorthEstimate,
  type EmployabilityDataset,
  type EmployabilityUniversity,
  type EmployabilityDegree,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import SalaryBandBar from "@/components/insights/SalaryBandBar";
import { rateColor } from "@/components/insights/PercentDial";
import WorldPicker from "@/components/worth/WorldPicker";
import UniversityTiles from "@/components/worth/UniversityTiles";

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
  const [dataset, setDataset] = useState<EmployabilityDataset | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [uniId, setUniId] = useState("");
  const [degreeField, setDegreeField] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("aura_location_filter");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only; standard mount-time init
    if (saved) setLocation(saved);
    // university graduate-outcomes dataset (curated, cited, no LLM); best-effort
    api.employabilityDataset().then(setDataset).catch(() => {});
  }, []);

  const selectedUni = useMemo(
    () => dataset?.universities.find((u) => u.id === uniId) ?? null,
    [dataset, uniId]
  );
  const selectedDegree = useMemo(
    () => selectedUni?.degrees.find((d) => d.field === degreeField) ?? null,
    [selectedUni, degreeField]
  );

  /** University grounding, derived purely from the curated dataset (no API). */
  const grounding = useMemo(() => {
    if (!dataset || !selectedUni) return null;
    const rate = selectedDegree?.employment_rate_pct ?? selectedUni.employment_rate_pct ?? null;
    const band = selectedDegree?.salary ?? null;
    let rank: number | null = null;
    let total = 0;
    let leaderboard: { name: string; rate: number; you: boolean }[] = [];
    if (selectedDegree) {
      const peers = dataset.universities
        .map((u) => ({ u, d: u.degrees.find((d) => d.field === selectedDegree.field) }))
        .filter(
          (x): x is { u: EmployabilityUniversity; d: EmployabilityDegree } =>
            !!x.d && x.d.employment_rate_pct !== null
        )
        .sort((a, b) => (b.d.employment_rate_pct as number) - (a.d.employment_rate_pct as number));
      total = peers.length;
      const idx = peers.findIndex((p) => p.u.id === selectedUni.id);
      rank = idx >= 0 ? idx + 1 : null;
      leaderboard = peers.slice(0, 3).map((p) => ({
        name: p.u.name,
        rate: p.d.employment_rate_pct as number,
        you: p.u.id === selectedUni.id,
      }));
    }
    const ids = new Set<string>([
      ...(selectedDegree?.source_ids ?? []),
      ...(band?.source_ids ?? []),
      ...selectedUni.source_ids,
    ]);
    const sources = dataset.sources.filter((s) => ids.has(s.id));
    return { uni: selectedUni, field: selectedDegree?.field ?? null, rate, band, rank, total, leaderboard, sources };
  }, [dataset, selectedUni, selectedDegree]);

  async function run() {
    setError("");
    setNoResume(false);
    setBusy(true);
    setResult(null);
    try {
      const r = await api.selfWorth({
        ...(location ? { location } : {}),
        ...(uniId ? { university_id: uniId } : {}),
        ...(degreeField ? { degree_field: degreeField } : {}),
        ...(country ? { country } : {}),
      });
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
            <div className="page-kicker">(01) // FAIR_PAY_ENGINE</div>
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
          <div className="page-kicker">(01) // FAIR_PAY_ENGINE</div>
          <h1>What you&apos;re worth</h1>
          <p>
            Aura prices your resume against the live market and grounds it in
            your university&apos;s real graduate outcomes — your band, where you
            sit, and the moves that raise it.
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
                (set from the map · edit to refine, e.g. Remote)
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

          <div className="field" style={{ marginBottom: "1rem" }}>
            <label>
              Where did you study?{" "}
              <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-55)" }}>
                (optional · SG/MY)
              </span>
            </label>
            <div style={{ border: "1px solid var(--ink-30)", background: "var(--surface)" }}>
              <WorldPicker
                selected={country}
                onSelect={(c) => {
                  setCountry(c.code);
                  setLocation(c.name); // the map also sets the target market
                  setUniId("");
                  setDegreeField("");
                }}
              />
            </div>
          </div>

          {country && (
            <div className="field" style={{ marginBottom: "1rem" }}>
              <label>University</label>
              <UniversityTiles
                country={country as "SG" | "MY"}
                selectedId={uniId}
                onSelect={(u) => {
                  setUniId(u.id);
                  setDegreeField("");
                }}
              />
            </div>
          )}

          {selectedUni && selectedUni.degrees.length > 0 && (
            <div className="field" style={{ marginBottom: "1rem" }}>
              <label>Degree / field</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {selectedUni.degrees
                  .slice()
                  .sort((a, b) => a.field.localeCompare(b.field))
                  .map((d) => {
                    const on = degreeField === d.field;
                    return (
                      <button
                        key={d.field}
                        type="button"
                        onClick={() => setDegreeField(d.field)}
                        className={`font-[family-name:var(--font-space)] uppercase text-[0.68rem] tracking-[0.05em] px-3 py-[6px] border transition-colors ${
                          on
                            ? "bg-[var(--iris)] text-white border-[color:var(--iris)]"
                            : "bg-[var(--surface)] text-[color:var(--ink-72)] border-[color:var(--ink-30)] hover:border-[color:var(--iris)] hover:text-[color:var(--iris)]"
                        }`}
                      >
                        {d.field}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          {selectedUni && selectedUni.degrees.length === 0 && (
            <p className="mono" style={{ fontSize: "0.72rem", color: "var(--ink-55)", marginBottom: "1rem" }}>
              // NO_PER_DEGREE_SALARY_DATA_FOR_THIS_SCHOOL — showing overall employment rate
            </p>
          )}

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

        {grounding && grounding.rate !== null && (
          <div className="panel" style={{ marginTop: "1.25rem" }}>
            <div className="page-kicker" style={{ marginBottom: "1.25rem" }}>
              UNIVERSITY_GROUNDING // {grounding.uni.name.toUpperCase()}
            </div>

            <div style={{ display: "grid", gap: "1.75rem" }}>
              <div>
                <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.45rem" }}>
                  {grounding.field ? `${grounding.field} · employed within 6 months` : "Overall employment rate"}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "var(--font-space), monospace", fontWeight: 700, fontSize: "2.6rem", lineHeight: 1, color: rateColor(grounding.rate) }}>
                    {grounding.rate.toFixed(1)}
                  </span>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--ink-55)" }}>% employed</span>
                </div>
              </div>

              {grounding.band && (
                <div>
                  <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.65rem" }}>
                    Fresh-grad starting salary
                  </div>
                  <SalaryBandBar band={grounding.band} />
                </div>
              )}

              {grounding.rank && grounding.field && (
                <div>
                  <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.65rem" }}>
                    Rank #{grounding.rank} of {grounding.total} · {grounding.field}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {grounding.leaderboard.map((row, i) => (
                      <div
                        key={row.name}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontFamily: "var(--font-space), monospace",
                          fontSize: "0.78rem",
                          padding: "0.45rem 0.7rem",
                          border: `1px solid ${row.you ? "var(--iris)" : "var(--ink-12)"}`,
                          background: row.you ? "var(--iris-08)" : "transparent",
                          color: row.you ? "var(--iris-deep)" : "var(--ink-72)",
                        }}
                      >
                        <span>
                          {i + 1}. {row.name}
                          {row.you ? " (you)" : ""}
                        </span>
                        <span style={{ color: rateColor(row.rate), fontWeight: 700 }}>{row.rate.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {grounding.sources.length > 0 && (
              <div className="sal-footer" style={{ marginTop: "1.25rem" }}>
                <span className="sal-source">{grounding.sources.map((s) => s.label).join(" · ")}</span>
              </div>
            )}
          </div>
        )}

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
