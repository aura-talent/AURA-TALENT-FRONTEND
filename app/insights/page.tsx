"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  type Application,
  type EmployabilityDataset,
  type EmployabilityRole,
  type EmployabilityRoleBand,
  type EmployabilitySalaryBand,
  type EmployabilityUniversity,
} from "@/lib/api";
import { rateColor } from "@/components/insights/PercentDial";
import SalaryBandBar from "@/components/insights/SalaryBandBar";

type Country = "MY" | "SG";
type GridMode = "universities" | "roles";

/** Loose role→degree-field matcher for SG per-degree GES rows. */
function degreeForRole(uni: EmployabilityUniversity, roleTitle: string) {
  const t = roleTitle.toLowerCase();
  const wanted = t.includes("data")
    ? ["business analytics", "data science", "information systems"]
    : t.includes("product")
      ? ["information systems", "business"]
      : ["computer science", "computer engineering", "computing", "software"];
  for (const w of wanted) {
    const hit = uni.degrees.find((d) => d.field.toLowerCase().includes(w));
    if (hit) return hit;
  }
  return uni.degrees[0] ?? null;
}

const fmt = (n: number) => n.toLocaleString("en-US");
const shortName = (name: string) => name.replace(/\s*\(.*\)$/, "");

/** typical role range → the band-bar's percentile shape (no median marker) */
const typicalAsBand = (b: EmployabilityRoleBand): EmployabilitySalaryBand => ({
  p25: b.typical.lo, p50: null, p75: b.typical.hi, currency: b.currency, period: b.period,
});

const SUPERSCRIPTS = "¹²³⁴⁵⁶⁷⁸⁹";

export default function InsightsPage() {
  const [dataset, setDataset] = useState<EmployabilityDataset | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<Country>("MY");
  const [uniId, setUniId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>("");
  const [gridMode, setGridMode] = useState<GridMode>("universities");
  const [sortDesc, setSortDesc] = useState(true);

  // all setState happens inside async callbacks (never synchronously in the
  // effect body); the retry button clears the error itself before reloading
  const load = () => {
    api
      .employabilityDataset()
      .then((d) => {
        setDataset(d);
        const firstUni = d.universities.find((u) => u.country === "MY") ?? d.universities[0];
        if (firstUni) {
          setCountry(firstUni.country);
          setUniId(firstUni.id);
        }
        if (d.roles[0]) setRoleId(d.roles[0].id);
        // best-effort prefill from the resume (page works without one)
        api
          .getResume()
          .then((r) => {
            const md = (r.markdown || "").toLowerCase();
            const uniHit = d.universities.find((u) => md.includes(shortName(u.name).toLowerCase()));
            if (uniHit) {
              setCountry(uniHit.country);
              setUniId(uniHit.id);
            }
            const roleHit = d.roles.find((role) => md.includes(role.title.toLowerCase()));
            if (roleHit) setRoleId(roleHit.id);
          })
          .catch(() => {});
        api
          .listApplications()
          .then(setApplications)
          .catch(() => {});
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load data"));
  };
  useEffect(load, []);

  const unis = useMemo(
    () => (dataset?.universities ?? []).filter((u) => u.country === country),
    [dataset, country]
  );
  const uni = unis.find((u) => u.id === uniId) ?? unis[0] ?? null;
  const roles = useMemo(() => {
    const all = dataset?.roles ?? [];
    const withBand = all.filter((r) => r.salary[country]);
    return withBand.length ? withBand : all; // SG: titles still drive the degree matcher
  }, [dataset, country]);
  const role: EmployabilityRole | null = roles.find((r) => r.id === roleId) ?? roles[0] ?? null;

  const degree = uni && role && uni.degrees.length ? degreeForRole(uni, role.title) : null;
  const heroRate = degree?.employment_rate_pct ?? uni?.employment_rate_pct ?? null;
  const roleBand = role?.salary[country] ?? null;

  // numbered citations: dataset source order → ¹ ² ³ …
  const sourceIndex = useMemo(() => {
    const m = new Map<string, number>();
    (dataset?.sources ?? []).forEach((s, i) => m.set(s.id, i + 1));
    return m;
  }, [dataset]);
  const refs = (ids?: string[]) => {
    const nums = (ids ?? []).map((id) => sourceIndex.get(id)).filter((n): n is number => !!n);
    if (!nums.length) return null;
    const labels = (ids ?? [])
      .map((id) => dataset?.sources.find((s) => s.id === id)?.label)
      .filter(Boolean)
      .join(" · ");
    return (
      <sup className="mono" title={labels} style={{ color: "var(--iris)", fontSize: "0.55em", cursor: "help", marginLeft: 3 }}>
        {nums.map((n) => SUPERSCRIPTS[n - 1] ?? `(${n})`).join(" ")}
      </sup>
    );
  };

  // benchmark: MY has a published national average; SG compares against the
  // average of the degrees tracked here (labeled as exactly that)
  const benchmark = useMemo(() => {
    if (!dataset || !uni) return null;
    const published = dataset.benchmarks?.[country];
    if (published) return { pct: published.employment_rate_pct, label: published.label, source_ids: published.source_ids };
    const rates = (dataset.universities ?? [])
      .filter((u) => u.country === country)
      .flatMap((u) => u.degrees.map((d) => d.employment_rate_pct).filter((x): x is number => x !== null));
    if (!rates.length) return null;
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    return { pct: avg, label: `average across the ${rates.length} ${country} degrees tracked here`, source_ids: [] };
  }, [dataset, country, uni]);

  // ranking of the selected university among same-country tracked ones
  const ranking = useMemo(() => {
    if (!uni || !role) return null;
    const rows = unis
      .map((u) => ({
        u,
        rate: u.degrees.length ? degreeForRole(u, role.title)?.employment_rate_pct ?? null : u.employment_rate_pct,
      }))
      .filter((x): x is { u: EmployabilityUniversity; rate: number } => x.rate !== null)
      .sort((a, b) => b.rate - a.rate);
    const pos = rows.findIndex((x) => x.u.id === uni.id);
    return { rows, pos: pos === -1 ? null : pos + 1, total: rows.length };
  }, [unis, uni, role]);

  // "you on this chart": tracked applications whose role matches the selection
  const myApps = useMemo(() => {
    if (!role) return [];
    const key = role.title.toLowerCase().split(/[^a-z]+/)[0]; // backend, software, data…
    return applications.filter((a) => (a.role || "").toLowerCase().includes(key));
  }, [applications, role]);
  const myAvgFit = myApps.length
    ? myApps.reduce((s, a) => s + (a.score ?? 0), 0) / myApps.length
    : null;

  const gridUnis = useMemo(() => {
    const rows = unis.map((u) => {
      const deg = role ? degreeForRole(u, role.title) : null;
      return { u, rate: deg?.employment_rate_pct ?? u.employment_rate_pct, band: deg?.salary ?? null, field: deg?.field ?? null };
    });
    rows.sort((a, b) => ((a.rate ?? -1) - (b.rate ?? -1)) * (sortDesc ? -1 : 1));
    return rows;
  }, [unis, role, sortDesc]);

  const gridRoles = useMemo(() => {
    const rows =
      country === "SG" && uni
        ? uni.degrees.map((d) => ({
            key: d.field, title: d.field, band: d.salary,
            mid: d.salary.p50 ?? (d.salary.p25 + d.salary.p75) / 2, isCurrent: false,
          }))
        : roles
            .filter((r) => r.salary[country])
            .map((r) => {
              const b = r.salary[country]!;
              return {
                key: r.id, title: r.title, band: typicalAsBand(b),
                mid: (b.typical.lo + b.typical.hi) / 2, isCurrent: r.id === role?.id,
              };
            });
    rows.sort((a, b) => (a.mid - b.mid) * (sortDesc ? -1 : 1));
    return rows;
  }, [roles, country, sortDesc, uni, role]);

  if (error) {
    return (
      <main className="container" style={{ padding: "4rem 0", textAlign: "center" }}>
        <p style={{ color: "var(--ink-72)" }}>{error}</p>
        <button className="btn btn-primary" onClick={() => { setError(null); load(); }} style={{ marginTop: "1rem" }}>
          Try again
        </button>
      </main>
    );
  }
  if (!dataset || !uni || !role) {
    return (
      <main className="container" style={{ padding: "4rem 0" }}>
        <p className="mono" style={{ color: "var(--ink-55)", fontSize: "0.85rem" }}>Loading…</p>
      </main>
    );
  }

  const inlineSelect = (
    value: string,
    onChange: (v: string) => void,
    options: { value: string; label: string }[],
    aria: string
  ) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={aria}
      className="lg-select"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );

  const surveyLine = degree
    ? `MOE Graduate Employment Survey ${uni.survey_year ?? ""} · fresh graduates, ${degree.field}`
    : uni.respondents
      ? `MOHE graduate survey ${uni.survey_year ?? ""} · ${fmt(uni.respondents)} graduates surveyed`
      : uni.employment_rate_pct !== null
        ? `As reported by the university, citing MOHE's ${uni.survey_year ?? ""} survey`
        : "";

  const delta = heroRate !== null && benchmark ? heroRate - benchmark.pct : null;

  return (
    <main className="container lg-page" style={{ padding: "2.5rem 0 4rem" }}>
      <style>{`
        .lg-page { display: flex; flex-direction: column; gap: 0; }
        .lg-reveal { animation: lg-in 0.55s ease both; }
        @keyframes lg-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) { .lg-reveal { animation: none; } }

        .lg-select {
          appearance: none; background: transparent; border: none;
          border-bottom: 2px solid var(--iris); color: var(--iris);
          font-family: inherit; font-weight: 700; font-size: inherit;
          padding: 0 0.15rem 0.1rem; cursor: pointer; max-width: min(60vw, 26rem);
        }
        .lg-select:focus-visible { outline: 2px solid var(--iris); outline-offset: 3px; }

        /* ledger rows: label | statement | meta */
        .lg-row {
          display: grid; grid-template-columns: 150px 1fr 230px;
          gap: clamp(1rem, 3vw, 2.5rem); padding: 1.6rem 0;
          border-top: 1px solid var(--ink-12); align-items: start;
        }
        .lg-row:last-of-type { border-bottom: 1px solid var(--ink-12); }
        .lg-label {
          font-size: 0.62rem; letter-spacing: 0.24em; text-transform: uppercase;
          color: var(--ink-55); padding-top: 0.55rem; line-height: 1.8;
        }
        .lg-label b { display: block; color: var(--iris); font-weight: 400; }
        .lg-numeral {
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(2.4rem, 6vw, 3.8rem); line-height: 1;
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
        }
        .lg-numeral small { font-size: 0.32em; font-weight: 500; color: var(--ink-55); letter-spacing: 0; margin-left: 0.4em; font-family: var(--font-body, inherit); }
        .lg-sentence { margin: 0.7rem 0 0; font-size: 0.92rem; line-height: 1.6; color: var(--ink-72); max-width: 52ch; }
        .lg-meta { font-size: 0.7rem; color: var(--ink-30); line-height: 1.7; padding-top: 0.55rem; }
        .lg-meta a { color: var(--iris); text-decoration: none; }
        .lg-chip {
          display: inline-block; margin-top: 0.8rem; padding: 0.32rem 0.75rem; border-radius: 99px;
          font-size: 0.7rem;
        }
        .lg-actions { display: flex; flex-wrap: wrap; gap: 1.4rem; margin-top: 0.9rem; }
        .lg-actions a {
          font-size: 0.74rem; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--iris); text-decoration: none; border-bottom: 1px solid var(--iris-12);
          padding-bottom: 2px; transition: border-color 0.2s;
        }
        .lg-actions a:hover { border-color: var(--iris); }

        /* ledger table */
        .lg-table { width: 100%; border-collapse: collapse; }
        .lg-table th {
          text-align: left; font-weight: 400; font-size: 0.62rem; letter-spacing: 0.2em;
          text-transform: uppercase; color: var(--ink-55); padding: 0 0.8rem 0.55rem 0;
          border-bottom: 2px solid var(--ink); white-space: nowrap;
        }
        .lg-table td { padding: 0.8rem 0.8rem 0.8rem 0; border-bottom: 1px solid var(--ink-12); vertical-align: middle; }
        .lg-table tr.current td { background: var(--iris-08); box-shadow: inset 3px 0 0 var(--iris); }
        .lg-table tr.current td:first-child { padding-left: 0.8rem; }

        .lg-controls button {
          background: transparent; border: none; cursor: pointer; padding: 0.35rem 0;
          font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--ink-55); border-bottom: 2px solid transparent; margin-right: 1.4rem;
        }
        .lg-controls button[aria-pressed="true"] { color: var(--ink); border-color: var(--iris); }

        @media (max-width: 760px) {
          .lg-row { grid-template-columns: 1fr; gap: 0.6rem; }
          .lg-label { padding-top: 0; }
          .lg-meta { padding-top: 0; }
          .lg-table .lg-hide-sm { display: none; }
        }
      `}</style>

      <header className="lg-reveal" style={{ paddingBottom: "1.6rem" }}>
        <div className="page-kicker mono" style={{ color: "var(--iris)", fontSize: "0.7rem", letterSpacing: "0.24em" }}>
          INSIGHTS · THE GRADUATE LEDGER
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.9rem, 4.4vw, 2.9rem)", margin: "0.4rem 0 0.4rem", letterSpacing: "-0.02em" }}>
          Will your degree get you hired?
        </h1>
        <p style={{ color: "var(--ink-55)", maxWidth: "62ch", margin: 0, fontSize: "0.95rem" }}>
          Real numbers from government graduate surveys and published salary guides. Nothing here is
          estimated — every figure carries its citation.
        </p>
        <div className="mono" style={{ marginTop: "0.9rem", fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-30)" }}>
          Compiled {dataset.updated} · {dataset.sources.length} published sources · Malaysia &amp; Singapore
        </div>
      </header>

      {/* sentence picker */}
      <div className="lg-reveal" style={{ animationDelay: "70ms", fontSize: "clamp(1.05rem, 2.4vw, 1.35rem)", lineHeight: 2, color: "var(--ink)", fontWeight: 500, paddingBottom: "1.6rem" }}>
        Graduates from{" "}
        {inlineSelect(uni.id, setUniId, unis.map((u) => ({ value: u.id, label: shortName(u.name) })), "University")}{" "}
        aiming for{" "}
        {inlineSelect(role.id, setRoleId, roles.map((r) => ({ value: r.id, label: r.title })), "Target role")}{" "}
        in{" "}
        <span style={{ display: "inline-flex", verticalAlign: "middle", border: "1px solid var(--ink-30)", borderRadius: 9, overflow: "hidden" }}>
          {(["MY", "SG"] as Country[]).map((c) => (
            <button
              key={c}
              onClick={() => { setCountry(c); setUniId(""); }}
              className="mono"
              aria-pressed={country === c}
              style={{
                padding: "0.25rem 0.7rem", fontSize: "0.78rem", border: "none", cursor: "pointer",
                background: country === c ? "var(--iris)" : "transparent",
                color: country === c ? "#fff" : "var(--ink-72)",
              }}
            >
              {c === "MY" ? "Malaysia" : "Singapore"}
            </button>
          ))}
        </span>
      </div>

      {/* Q1 — hired */}
      <section className="lg-row lg-reveal" style={{ animationDelay: "140ms" }} aria-label="Employment outcome">
        <div className="lg-label mono"><b>Q1</b>Will I get hired?</div>
        <div>
          {heroRate !== null ? (
            <>
              <div className="lg-numeral" style={{ color: rateColor(heroRate) }}>
                {heroRate.toFixed(1)}%
                <small>employed</small>
                {refs(degree?.source_ids ?? uni.source_ids)}
              </div>
              <p className="lg-sentence">
                {degree
                  ? <>of {shortName(uni.name)} <b>{degree.field}</b> fresh graduates secured jobs within six months.</>
                  : <>of {shortName(uni.name)} graduates in the workforce were employed after graduating.</>}
              </p>
              {delta !== null && benchmark && (
                <span
                  className="lg-chip mono"
                  style={{
                    background: delta >= 0 ? "rgba(23,133,92,0.09)" : "rgba(188,74,42,0.09)",
                    color: delta >= 0 ? "var(--score-strong)" : "var(--score-weak)",
                  }}
                >
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pts {delta >= 0 ? "above" : "below"} the {benchmark.pct.toFixed(1)}% {benchmark.label}
                </span>
              )}
            </>
          ) : (
            <>
              <div className="lg-numeral" style={{ color: "var(--ink-30)" }}>—</div>
              <p className="lg-sentence">
                MOHE hasn&apos;t published an employment rate for {shortName(uni.name)} — we don&apos;t fill gaps with guesses.
              </p>
            </>
          )}
        </div>
        <div className="lg-meta mono">{surveyLine}</div>
      </section>

      {/* Q2 — earn */}
      <section className="lg-row lg-reveal" style={{ animationDelay: "210ms" }} aria-label="Salary">
        <div className="lg-label mono"><b>Q2</b>What will I earn?</div>
        <div>
          {degree ? (
            <>
              <div className="lg-numeral">
                {degree.salary.currency} {fmt(degree.salary.p50 ?? degree.salary.p25)}
                <small>/mo median · fresh grad</small>
                {refs(degree.source_ids)}
              </div>
              <div style={{ maxWidth: 420, marginTop: "1rem" }}>
                <SalaryBandBar band={degree.salary} />
              </div>
              <p className="lg-sentence">
                The middle half of {degree.field} graduates started between {degree.salary.currency} {fmt(degree.salary.p25)} and {degree.salary.currency} {fmt(degree.salary.p75)}.
              </p>
            </>
          ) : roleBand ? (
            <>
              <div className="lg-numeral">
                {roleBand.currency} {fmt(roleBand.typical.lo)}–{fmt(roleBand.typical.hi)}
                <small>/mo typical today</small>
                {refs(roleBand.source_ids)}
              </div>
              {(roleBand.junior !== null || roleBand.senior !== null) && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.82rem", color: "var(--ink-72)", marginTop: "1rem", maxWidth: 460 }}>
                  {roleBand.junior !== null && <span>junior from <b>{roleBand.currency} {fmt(roleBand.junior)}</b></span>}
                  <span aria-hidden="true" style={{ flex: 1, height: 1, background: "linear-gradient(90deg, var(--aura-a), var(--iris))", minWidth: 30 }} />
                  {roleBand.senior !== null && <span>senior up to <b>{roleBand.currency} {fmt(roleBand.senior)}</b></span>}
                </div>
              )}
              <p className="lg-sentence">
                The headline range is JobStreet&apos;s live market data across seniorities; the trajectory
                anchors come from the Randstad and Hays 2025 guides.
              </p>
            </>
          ) : (
            <>
              <div className="lg-numeral" style={{ color: "var(--ink-30)" }}>—</div>
              <p className="lg-sentence">No published salary data for this selection.</p>
            </>
          )}
        </div>
        <div className="lg-meta mono">{degree ? surveyLine : `${role.title} · Malaysia salary guides 2025`}</div>
      </section>

      {/* Q3 — standing */}
      <section className="lg-row lg-reveal" style={{ animationDelay: "280ms" }} aria-label="University standing">
        <div className="lg-label mono"><b>Q3</b>How does {shortName(uni.name)} compare?</div>
        <div>
          {ranking && ranking.pos !== null ? (
            <div className="lg-numeral">
              #{ranking.pos}
              <small>of {ranking.total} tracked {country === "MY" ? "Malaysian" : "Singaporean"} universities</small>
            </div>
          ) : (
            <>
              <div className="lg-numeral" style={{ color: "var(--ink-30)" }}>n/a</div>
              <p className="lg-sentence">Not ranked — no published employment rate.</p>
            </>
          )}
          {ranking && (
            <ol style={{ margin: "1rem 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "0.4rem", maxWidth: 380 }}>
              {ranking.rows.slice(0, 3).map(({ u, rate }, i) => (
                <li
                  key={u.id}
                  style={{
                    display: "flex", justifyContent: "space-between", gap: "0.8rem", fontSize: "0.86rem",
                    fontWeight: u.id === uni.id ? 700 : 400,
                    color: u.id === uni.id ? "var(--ink)" : "var(--ink-72)",
                    borderBottom: "1px solid var(--ink-06)", paddingBottom: "0.3rem",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i + 1}. {shortName(u.name)}</span>
                  <span className="mono" style={{ color: rateColor(rate) }}>{rate.toFixed(1)}%</span>
                </li>
              ))}
            </ol>
          )}
          <div className="lg-actions">
            <a href="#compare">full comparison ↓</a>
          </div>
        </div>
        <div className="lg-meta mono">ranked by employment rate among universities tracked in this ledger</div>
      </section>

      {/* YOU — personal strip */}
      <section className="lg-row lg-reveal" style={{ animationDelay: "350ms" }} aria-label="Your track record">
        <div className="lg-label mono"><b>YOU</b>On this chart</div>
        <div>
          {myApps.length > 0 && myAvgFit !== null ? (
            <>
              <div className="lg-numeral" style={{ color: "var(--iris)" }}>
                {myAvgFit.toFixed(1)}<small>/5 average fit</small>
              </div>
              <p className="lg-sentence">
                You&apos;ve evaluated <b>{myApps.length}</b> {role.title.toLowerCase()} job{myApps.length === 1 ? "" : "s"} with
                Aura — your average fit score is {myAvgFit.toFixed(1)}. That&apos;s your side of these market numbers.
              </p>
            </>
          ) : (
            <p className="lg-sentence" style={{ marginTop: "0.4rem" }}>
              You haven&apos;t evaluated any <b>{role.title.toLowerCase()}</b> postings yet — run one against
              this benchmark and this row becomes about you.
            </p>
          )}
          <div className="lg-actions">
            <Link href="/evaluate">evaluate a job against this benchmark →</Link>
            <Link href="/worth">price your own worth →</Link>
            {myApps.length > 0 && <Link href="/tracker">open your tracker →</Link>}
          </div>
        </div>
        <div className="lg-meta mono">from your tracked applications — private to you, not part of the ledger</div>
      </section>

      {/* comparison ledger table */}
      <section id="compare" className="lg-reveal" style={{ animationDelay: "420ms", paddingTop: "2.4rem" }}>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", margin: "0 0 0.3rem", letterSpacing: "-0.01em" }}>The full ledger</h2>
        <p style={{ color: "var(--ink-55)", fontSize: "0.85rem", margin: "0 0 1.1rem", maxWidth: "60ch" }}>
          {gridMode === "universities"
            ? `Employment rates ${country === "SG" ? `for ${role.title}-related degrees` : ""} across the ${country === "MY" ? "Malaysian" : "Singaporean"} universities we track.`
            : country === "SG"
              ? `Fresh-graduate salaries across ${shortName(uni.name)}'s tracked degrees.`
              : "Typical current-market salaries across tech roles in Malaysia."}
        </p>
        <div className="lg-controls" style={{ marginBottom: "0.9rem" }}>
          <button className="mono" aria-pressed={gridMode === "universities"} onClick={() => setGridMode("universities")}>
            by universities
          </button>
          <button className="mono" aria-pressed={gridMode === "roles"} onClick={() => setGridMode("roles")}>
            by {country === "SG" ? "degrees" : "roles"}
          </button>
          <button className="mono" onClick={() => setSortDesc((s) => !s)}>
            sort {sortDesc ? "↓" : "↑"}
          </button>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="lg-table">
            <thead>
              <tr>
                <th>{gridMode === "universities" ? "University" : country === "SG" ? "Degree" : "Role"}</th>
                <th>{gridMode === "universities" ? "Employed" : "Salary"}</th>
                <th className="lg-hide-sm">{gridMode === "universities" ? "Salary band" : "Band"}</th>
              </tr>
            </thead>
            <tbody>
              {gridMode === "universities"
                ? gridUnis.map(({ u, rate, band, field }) => (
                    <tr key={u.id} className={u.id === uni.id ? "current" : undefined}>
                      <td style={{ minWidth: 190 }}>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{shortName(u.name)}</div>
                        <div className="mono" style={{ fontSize: "0.64rem", color: "var(--ink-55)" }}>
                          {field ?? (u.respondents ? `${fmt(u.respondents)} surveyed · ${u.survey_year}` : "")}
                        </div>
                      </td>
                      <td className="mono" style={{ fontSize: "0.92rem", fontWeight: 700, color: rate !== null ? rateColor(rate) : "var(--ink-30)", whiteSpace: "nowrap" }}>
                        {rate !== null ? `${rate.toFixed(1)}%` : "no data"}
                      </td>
                      <td className="lg-hide-sm" style={{ minWidth: 220 }}>
                        {band ? <SalaryBandBar band={band} compact /> : (
                          <span className="mono" style={{ fontSize: "0.66rem", color: "var(--ink-30)" }}>
                            {country === "MY" ? "salary tracked per role, not per university" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                : gridRoles.map(({ key, title, band, isCurrent }) => (
                    <tr key={key} className={isCurrent ? "current" : undefined}>
                      <td style={{ minWidth: 170, fontWeight: 600, fontSize: "0.9rem" }}>{title}</td>
                      <td className="mono" style={{ fontSize: "0.86rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                        {band.p50 !== null
                          ? <>{band.currency} {fmt(band.p50)}<span style={{ color: "var(--ink-55)", fontWeight: 400 }}>/mo med</span></>
                          : <>{band.currency} {fmt(band.p25)}–{fmt(band.p75)}<span style={{ color: "var(--ink-55)", fontWeight: 400 }}>/mo</span></>}
                      </td>
                      <td className="lg-hide-sm" style={{ minWidth: 220 }}>
                        <SalaryBandBar band={band} compact />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* numbered sources */}
      <footer className="lg-reveal" style={{ animationDelay: "480ms", borderTop: "2px solid var(--ink)", marginTop: "2.6rem", paddingTop: "1.1rem" }}>
        <div className="mono" style={{ fontSize: "0.64rem", letterSpacing: "0.2em", color: "var(--ink-55)", textTransform: "uppercase", marginBottom: "0.7rem" }}>
          Sources — every number above resolves to one of these
        </div>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {dataset.sources.map((s) => (
            <li key={s.id} style={{ fontSize: "0.78rem" }}>
              <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--iris)" }}>{s.label}</a>
            </li>
          ))}
        </ol>
      </footer>
    </main>
  );
}
