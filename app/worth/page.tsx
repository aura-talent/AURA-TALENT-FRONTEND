"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import {
  api,
  ApiError,
  type FairPayResult,
  type EmployabilityDataset,
  type EmployabilityUniversity,
  type EmployabilityDegree,
} from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import SalaryBandBar from "@/components/insights/SalaryBandBar";
import { rateColor } from "@/components/insights/PercentDial";
import WorldPicker from "@/components/worth/WorldPicker";
import UniversityTiles from "@/components/worth/UniversityTiles";
import BreakdownReceipt from "@/components/worth/BreakdownReceipt";
import TrajectoryChart from "@/components/worth/TrajectoryChart";
import AlternateRoles from "@/components/worth/AlternateRoles";

const CONF_LABEL: Record<FairPayResult["confidence"]["level"], string> = {
  high: "HIGH_CONFIDENCE",
  medium: "MEDIUM_CONFIDENCE",
  low: "LOW_CONFIDENCE",
};

const LIVE_COUNTRIES = new Set(["MY", "SG"]);

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, notation: "compact", maximumFractionDigits: 1,
    }).format(n);
  } catch {
    return `${currency} ${Math.round(n).toLocaleString()}`;
  }
}

export default function WorthPage() {
  const root = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noResume, setNoResume] = useState(false);
  const [result, setResult] = useState<FairPayResult | null>(null);
  const [dataset, setDataset] = useState<EmployabilityDataset | null>(null);

  const [country, setCountry] = useState<string | null>(null);
  const [countryName, setCountryName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [years, setYears] = useState<number>(0);
  const [uniId, setUniId] = useState("");
  const [degreeField, setDegreeField] = useState("");
  const [cityRefine, setCityRefine] = useState("");
  const [headline, setHeadline] = useState("");

  const isLive = country !== null && LIVE_COUNTRIES.has(country);

  useEffect(() => {
    api.employabilityDataset().then(setDataset).catch(() => {});
    // prefill role + years from the parsed resume; best-effort
    api
      .getResume()
      .then((res) => {
        const p = (res.profile ?? {}) as { headline?: string; years_of_experience?: number };
        if (typeof p.years_of_experience === "number") setYears(p.years_of_experience);
        if (p.headline) setHeadline(p.headline);
      })
      .catch(() => {});
  }, []);

  const selectedUni = useMemo(
    () => dataset?.universities.find((u) => u.id === uniId) ?? null,
    [dataset, uniId]
  );
  const selectedDegree = useMemo(
    () => selectedUni?.degrees.find((d) => d.field === degreeField) ?? null,
    [selectedUni, degreeField]
  );

  /** naive client-side guess: longest role title contained in the headline.
   * The server re-matches with aliases when role_id is not sent. Runs once
   * both the roles dataset and the resume headline have arrived (either can
   * land first), so it can't be starved by the mount-time race. */
  useEffect(() => {
    if (!dataset || !headline) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-driven prefill: fires once both the async dataset and resume headline have resolved, not on every render
    setRoleId((current) => {
      if (current) return current;
      const h = headline.toLowerCase();
      const hit = dataset.roles
        .filter((r) => h.includes(r.title.toLowerCase()))
        .sort((a, b) => b.title.length - a.title.length)[0];
      return hit?.id ?? "";
    });
  }, [dataset, headline]);

  /** Rank leaderboard vs peers offering the same degree (dataset-only). */
  const leaderboard = useMemo(() => {
    if (!dataset || !selectedUni || !selectedDegree) return null;
    const peers = dataset.universities
      .map((u) => ({ u, d: u.degrees.find((d) => d.field === selectedDegree.field) }))
      .filter(
        (x): x is { u: EmployabilityUniversity; d: EmployabilityDegree } =>
          !!x.d && x.d.employment_rate_pct !== null
      )
      .sort((a, b) => (b.d.employment_rate_pct as number) - (a.d.employment_rate_pct as number));
    const idx = peers.findIndex((p) => p.u.id === selectedUni.id);
    return {
      rank: idx >= 0 ? idx + 1 : null,
      total: peers.length,
      field: selectedDegree.field,
      rows: peers.slice(0, 3).map((p) => ({
        name: p.u.name,
        rate: p.d.employment_rate_pct as number,
        you: p.u.id === selectedUni.id,
      })),
    };
  }, [dataset, selectedUni, selectedDegree]);

  async function run() {
    if (!country) return;
    setError("");
    setNoResume(false);
    setBusy(true);
    setResult(null);
    try {
      const r = await api.fairPay({
        country,
        years,
        ...(roleId ? { role_id: roleId } : {}),
        ...(uniId ? { university_id: uniId } : {}),
        ...(degreeField ? { degree_field: degreeField } : {}),
        ...(cityRefine ? { city_refine: cityRefine } : {}),
      });
      setResult(r);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setNoResume(true);
      else setError("Could not estimate — please try again, or check the backend is running.");
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

  /* result reveal */
  useEffect(() => {
    if (!result) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } })
        .from(q(".worth-result > *"), { y: 20, autoAlpha: 0, stagger: 0.1 })
        .from(q(".worth-receipt-row"), { x: -14, autoAlpha: 0, stagger: 0.06 }, "-=0.35");
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
      <div className="container" style={{ maxWidth: 760, paddingBottom: "4rem" }}>
        <div className="page-head">
          <div className="page-kicker">(01) // FAIR_PAY_ENGINE</div>
          <h1>What you&apos;re worth</h1>
          <p>
            Pick where you&apos;ll work, confirm your role and experience, and Aura
            computes your band from published market data — then explains every
            factor, forecasts your trajectory, and prices the roles next door.
          </p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}
        {noResume && (
          <div className="notice notice-warn">
            No résumé on file for your account yet —{" "}
            <Link href="/onboarding" style={{ fontWeight: 600 }}>upload it first</Link>{" "}
            so Aura has something to price.
          </div>
        )}

        <div className="panel worth-form" data-tour="worth-form">
          <div className="field" style={{ marginBottom: "1rem" }}>
            <label>Where will you work?</label>
            <div style={{ border: "1px solid var(--ink-30)", background: "var(--surface)" }}>
              <WorldPicker
                selected={country}
                onSelect={(c) => {
                  setCountry(c.code);
                  setCountryName(c.name);
                  setUniId("");
                  setDegreeField("");
                }}
              />
            </div>
            {country && !isLive && (
              <p className="mono worth-llm-note">
                // {countryName.toUpperCase()} — LLM_ESTIMATE // NO_LOCAL_DATA — band will be
                model-estimated at low confidence
              </p>
            )}
          </div>

          <div className="worth-form-grid">
            <div className="field">
              <label htmlFor="worth-role">Role to price</label>
              <select
                id="worth-role"
                className="input"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
              >
                <option value="">Other / not listed (auto-detect)</option>
                {(dataset?.roles ?? []).map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="worth-years">Years of experience</label>
              <input
                id="worth-years"
                className="input"
                type="number"
                min={0}
                max={40}
                step={0.5}
                value={years}
                onChange={(e) => setYears(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="field">
              <label htmlFor="worth-city">
                City / remote{" "}
                <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-55)" }}>
                  (optional)
                </span>
              </label>
              <input
                id="worth-city"
                className="input"
                placeholder="Kuala Lumpur, Remote…"
                value={cityRefine}
                onChange={(e) => setCityRefine(e.target.value)}
              />
            </div>
          </div>

          {isLive && (
            <div className="field" style={{ marginBottom: "1rem" }}>
              <label>
                Where did you study?{" "}
                <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400, color: "var(--ink-55)" }}>
                  (optional · strongest for your first ~3 years)
                </span>
              </label>
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
          {country && !isLive && (
            <p className="mono worth-llm-note" style={{ marginBottom: "1rem" }}>
              // UNI_GROUNDING // MY_SG_ONLY
            </p>
          )}

          {isLive && selectedUni && selectedUni.degrees.length > 0 && (
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
                        className={`worth-chip${on ? " is-on" : ""}`}
                      >
                        {d.field}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
          {isLive && selectedUni && selectedUni.degrees.length === 0 && (
            <p className="mono worth-llm-note" style={{ marginBottom: "1rem" }}>
              // NO_PER_DEGREE_SALARY_DATA_FOR_THIS_SCHOOL — employment-rate context only
            </p>
          )}

          <button className="btn btn-primary" onClick={run} disabled={busy || !country}>
            {busy ? "Pricing…" : result ? "Recalculate" : country ? "Calculate my worth" : "Pick a country first"}
          </button>
          {busy && (
            <div className="scan-status" style={{ marginTop: "1rem" }}>
              <span className="scan-spinner" />
              PRICING // RESUME × MARKET_DATA
            </div>
          )}
        </div>

        {result && (
          <div className="worth-result">
            {/* A. Verdict */}
            <div className="panel worth-band-panel">
              <span className="eval-tick eval-tick-tl" />
              <span className="eval-tick eval-tick-tr" />
              <span className="eval-tick eval-tick-bl" />
              <span className="eval-tick eval-tick-br" />
              {result.grounding_mode === "llm" && (
                <div className="worth-llm-banner">LLM_ESTIMATE // NO_LOCAL_DATA</div>
              )}
              <div className="page-kicker" style={{ marginBottom: "0.4rem" }}>
                YOUR_BAND // {result.role_title.toUpperCase()} // {result.country}
              </div>

              <div className="worth-figure">
                {fmt(result.point, result.band.currency)}
                <span className="worth-figure-suffix">/mo · ≈{fmt(result.point * 12, result.band.currency)}/yr</span>
              </div>

              <div style={{ margin: "0.75rem 0 0.5rem" }}>
                <SalaryBandBar band={result.band} />
              </div>
              <p className="worth-percentile">
                You price at ~P{result.percentile.toFixed(0)} of this band.
              </p>

              <p className="worth-summary">{result.summary}</p>

              <div className="sal-footer">
                <span className="sal-conf" data-conf={result.confidence.level}>
                  <span className="sal-conf-dot" />
                  {CONF_LABEL[result.confidence.level]} // {result.confidence.reason}
                </span>
                <span className="sal-source">
                  {result.sources.join(" · ")} // {result.as_of}
                </span>
              </div>
            </div>

            {/* B. Receipt */}
            <div className="panel">
              <div className="page-kicker" style={{ marginBottom: "1rem" }}>
                BREAKDOWN // WHY_THIS_NUMBER
              </div>
              <BreakdownReceipt
                receipt={result.receipt}
                band={result.band}
                point={result.point}
                currency={result.band.currency}
              />
              {result.leverage.length > 0 && (
                <div className="worth-deltas" style={{ marginTop: "1.25rem" }}>
                  {result.leverage.map((d) => (
                    <div className="worth-delta" key={d.skill}>
                      <span className="worth-delta-pct">+{d.delta_pct}%</span>
                      <div>
                        <div className="worth-delta-skill">{d.skill}</div>
                        <p className="worth-delta-note">{d.note}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link href="/onboarding" className="btn btn-ghost" style={{ marginTop: "1.25rem" }}>
                Update my resume →
              </Link>
            </div>

            {/* C. Trajectory */}
            <div className="panel">
              <div className="page-kicker" style={{ marginBottom: "1rem" }}>
                TRAJECTORY // NOW_+1Y_+3Y_+5Y
              </div>
              <TrajectoryChart
                trajectory={result.trajectory}
                currency={result.band.currency}
                llmOnly={result.grounding_mode === "llm"}
              />
            </div>

            {/* D. Alternates */}
            {result.alternates.length > 0 && (
              <div className="panel">
                <div className="page-kicker" style={{ marginBottom: "1rem" }}>
                  IF_YOU_MOVED // ADJACENT_ROLES
                </div>
                <AlternateRoles alternates={result.alternates} />
              </div>
            )}

            {/* E. University grounding (demoted, only when a uni is selected) */}
            {result.uni_context && result.uni_context.rate !== null && (
              <div className="panel">
                <div className="page-kicker" style={{ marginBottom: "1.25rem" }}>
                  UNIVERSITY_GROUNDING // {result.uni_context.name.toUpperCase()}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                  <span style={{ fontFamily: "var(--font-space), monospace", fontWeight: 700, fontSize: "2.6rem", lineHeight: 1, color: rateColor(result.uni_context.rate) }}>
                    {result.uni_context.rate.toFixed(1)}
                  </span>
                  <span className="mono" style={{ fontSize: "0.8rem", color: "var(--ink-55)" }}>
                    % employed{result.uni_context.field ? ` · ${result.uni_context.field}` : ""}
                  </span>
                </div>
                {selectedDegree?.salary && (
                  <div style={{ marginTop: "1rem" }}>
                    <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.65rem" }}>
                      Fresh-grad starting salary
                    </div>
                    <SalaryBandBar band={selectedDegree.salary} />
                  </div>
                )}
                {leaderboard && leaderboard.rank && (
                  <div style={{ marginTop: "1.25rem" }}>
                    <div className="mono" style={{ fontSize: "0.68rem", letterSpacing: "0.08em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.65rem" }}>
                      Rank #{leaderboard.rank} of {leaderboard.total} · {leaderboard.field}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {leaderboard.rows.map((row, i) => (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
