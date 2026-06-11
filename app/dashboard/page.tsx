"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, STATUSES, type Application } from "@/lib/api";
import { scoreColor } from "@/components/ScoreDial";

export default function Dashboard() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listApplications().then(setApps).catch(() => setError("Could not load your tracker — is the backend running?"));
  }, []);

  async function changeStatus(id: number, status: string) {
    setApps((prev) =>
      prev?.map((a) => (a.evaluation_id === id ? { ...a, status } : a)) ?? null
    );
    try {
      await api.updateStatus(id, status);
    } catch {
      setError("Status update failed — refresh and try again.");
    }
  }

  return (
    <div className="container" style={{ paddingBottom: "4rem" }}>
      <div className="page-head">
        <h1>Your pipeline</h1>
        <p>Every job you&apos;ve evaluated, in one place. Update statuses as you hear back.</p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      {apps && apps.length === 0 && (
        <div className="panel" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
          <h3 style={{ marginBottom: "0.6rem" }}>No evaluations yet</h3>
          <p style={{ color: "var(--ink-72)", marginBottom: "1.5rem" }}>
            Paste your first job link and see where you stand.
          </p>
          <Link href="/evaluate" className="btn btn-primary">Evaluate a job</Link>
        </div>
      )}

      {apps && apps.length > 0 && (
        <div className="panel" style={{ padding: "0.5rem", overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Company</th>
                <th>Role</th>
                <th>Score</th>
                <th>Status</th>
                <th>Report</th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.evaluation_id}>
                  <td className="mono">{a.date}</td>
                  <td style={{ fontWeight: 600 }}>{a.company}</td>
                  <td>{a.role}</td>
                  <td>
                    <span className="score-pill" style={{ background: scoreColor(a.score) }}>
                      {a.score.toFixed(1)}
                    </span>
                  </td>
                  <td>
                    <select
                      className="select"
                      value={a.status}
                      onChange={(e) => changeStatus(a.evaluation_id, e.target.value)}
                      aria-label={`Status for ${a.company} ${a.role}`}
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td>
                    <Link href={`/report/${a.evaluation_id}`} style={{ color: "var(--iris)", fontWeight: 600 }}>
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!apps && !error && (
        <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--ink-55)" }}>Loading your pipeline…</p>
        </div>
      )}
    </div>
  );
}
