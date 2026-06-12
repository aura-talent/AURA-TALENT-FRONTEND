"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, type Application } from "@/lib/api";
import { scoreColor } from "@/components/ScoreDial";
import Thinking from "@/components/Thinking";
import ReportView from "@/components/ReportView";

export default function ComparePage() {
  const [apps, setApps] = useState<Application[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    api.listApplications().then(setApps).catch(() => setError("Could not load evaluations — is the backend running?"));
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

  if (busy) {
    return (
      <div className="app-sheet">
      <div className="container" style={{ maxWidth: 820 }}>
        <div className="page-head">
          <div className="page-kicker">COMPARISON_AGENT // RUNNING</div>
          <h1>Comparing</h1>
        </div>
        <div className="panel">
          <Thinking lines={[
            "Lining up your offers…",
            "Weighing trajectory against compensation…",
            "Writing the verdict…",
          ]} />
        </div>
      </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="app-sheet">
      <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
        <div className="page-head">
          <div className="page-kicker">(02) // HEAD_TO_HEAD</div>
          <h1>Head to head</h1>
        </div>
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <ReportView markdown={result} />
        </div>
        <button className="btn btn-primary" onClick={() => { setResult(null); setSelected(new Set()); }}>
          Compare different jobs
        </button>
      </div>
      </div>
    );
  }

  return (
    <div className="app-sheet">
    <div className="container" style={{ maxWidth: 760, paddingBottom: "4rem" }}>
      <div className="page-head">
        <div className="page-kicker">(01) // SELECTION</div>
        <h1>Compare offers</h1>
        <p>Pick two or more evaluated jobs. Aura ranks them and tells you where to focus — and what to drop.</p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {apps.length < 2 ? (
        <div className="panel" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
          <h3 style={{ marginBottom: "0.6rem" }}>You need at least two evaluations</h3>
          <p style={{ color: "var(--ink-72)", marginBottom: "1.5rem" }}>
            Evaluate a couple of jobs first, then come back to rank them.
          </p>
          <Link href="/evaluate" className="btn btn-primary">Evaluate a job</Link>
        </div>
      ) : (
        <>
          <div className="panel" style={{ marginBottom: "1.25rem" }}>
            {apps.map((a) => (
              <label
                key={a.evaluation_id}
                style={{
                  display: "flex", alignItems: "center", gap: "0.9rem",
                  padding: "0.8rem 0.4rem", borderBottom: "1px dashed var(--ink-12)",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(a.evaluation_id)}
                  onChange={() => toggle(a.evaluation_id)}
                  style={{ width: 18, height: 18, accentColor: "var(--iris)" }}
                />
                <span className="score-pill" style={{ background: scoreColor(a.score) }}>
                  {a.score.toFixed(1)}
                </span>
                <span style={{ fontWeight: 600 }}>{a.company}</span>
                <span style={{ color: "var(--ink-72)" }}>{a.role}</span>
              </label>
            ))}
          </div>
          <button className="btn btn-primary" disabled={selected.size < 2} onClick={run}>
            Compare {selected.size >= 2 ? `${selected.size} jobs` : "selected"}
          </button>
        </>
      )}
    </div>
    </div>
  );
}
