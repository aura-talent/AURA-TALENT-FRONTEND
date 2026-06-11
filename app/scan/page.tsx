"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, type JobPosting } from "@/lib/api";
import Thinking from "@/components/Thinking";

export default function ScanPage() {
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);

  async function run() {
    setError("");
    setBusy(true);
    setJobs(null);
    try {
      const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await api.scan(kw.length ? { title_keywords: kw } : {});
      setJobs(r.jobs);
    } catch {
      setError("Scan failed — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
      <div className="page-head">
        <h1>Find open roles</h1>
        <p>
          Aura checks the live job boards of tracked companies directly —
          no stale listings, no scraping middlemen.
        </p>
      </div>

      {error && <div className="notice notice-error">{error}</div>}

      <div className="panel" style={{ marginBottom: "1.5rem" }}>
        <div className="field">
          <label htmlFor="kw">Role keywords <span style={{ fontWeight: 400, color: "var(--ink-55)" }}>(optional, comma-separated)</span></label>
          <input
            id="kw"
            className="input"
            placeholder="AI Engineer, Forward Deployed, Solutions"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy}>
          Scan job boards
        </button>
      </div>

      {busy && (
        <div className="panel">
          <Thinking lines={[
            "Checking company job boards…",
            "Filtering titles to your targets…",
          ]} />
        </div>
      )}

      {jobs && (
        <>
          <p style={{ marginBottom: "1rem", color: "var(--ink-72)" }}>
            {jobs.length === 0
              ? "No matching roles right now — try broader keywords or check back in a few days."
              : `${jobs.length} matching roles found.`}
          </p>
          <div>
            {jobs.map((j) => (
              <div className="job-row" key={j.url}>
                <div style={{ minWidth: 0 }}>
                  <div className="job-title">{j.title}</div>
                  <div className="job-meta">
                    {j.company}{j.location ? ` · ${j.location}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                  <a href={j.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "0.45rem 1rem", fontSize: "0.84rem" }}>
                    View
                  </a>
                  <button
                    className="btn btn-primary"
                    style={{ padding: "0.45rem 1rem", fontSize: "0.84rem" }}
                    onClick={() => router.push(`/evaluate?url=${encodeURIComponent(j.url)}`)}
                  >
                    Score it
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
