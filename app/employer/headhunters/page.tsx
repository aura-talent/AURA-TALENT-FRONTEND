"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  headhunterInitials,
  headhunterStatusChipClass,
} from "../data";
import {
  employerApi,
  timeAgo,
  type EmployerHeadhunter,
  type EmployerJob,
} from "@/lib/employerApi";
import { Loader } from "@/components/ui/loader";

export default function HeadhuntersPage() {
  const [headhunters, setHeadhunters] = useState<EmployerHeadhunter[]>([]);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourcing, setSourcing] = useState<Set<string>>(new Set());
  const [sourced, setSourced] = useState<Set<string>>(new Set());

  async function sourceNow(headhunter: EmployerHeadhunter) {
    const jobId = headhunter.job_ids[0];
    if (!jobId) return;
    setSourcing((s) => new Set(s).add(headhunter.id));
    try {
      await employerApi.sourceHeadhunter(headhunter.id, jobId);
      setSourced((s) => new Set(s).add(headhunter.id));
    } catch (err) {
      console.error("Failed to start sourcing:", err);
    } finally {
      setSourcing((s) => {
        const next = new Set(s);
        next.delete(headhunter.id);
        return next;
      });
    }
  }

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listHeadhunters(), employerApi.listJobs()]).then(
      ([hhRes, jobsRes]) => {
        if (cancelled) return;
        if (hhRes.status === "fulfilled") setHeadhunters(hhRes.value);
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const jobTitle = (id: string) => jobs.find((job) => job.id === id)?.title;

  const activeCount = headhunters.filter((h) => h.status === "Active").length;
  const totalSourced = headhunters.reduce(
    (total, h) => total + (h.stats.candidates_sourced ?? 0),
    0,
  );
  const matchScores = headhunters
    .map((h) => h.stats.avg_match_score)
    .filter((score): score is number => score != null);
  const avgMatch = matchScores.length
    ? Math.round(
        matchScores.reduce((total, score) => total + score, 0) / matchScores.length,
      )
    : 0;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">AI sourcing</p>
          <h1>Headhunters</h1>
          <p>
            Configure and deploy AI agents that scout the talent pool for you,
            the way a real recruiter would.
          </p>
        </div>
        <Link href="/employer/headhunters/new" className="btn btn-primary">
          + New headhunter
        </Link>
      </div>

      <div className="stat-card-row">
        <article className="panel">
          <p>Total headhunters</p>
          <strong>{headhunters.length}</strong>
          <span>On your roster</span>
        </article>
        <article className="panel">
          <p>Active</p>
          <strong>{activeCount}</strong>
          <span>Currently sourcing</span>
        </article>
        <article className="panel">
          <p>Candidates sourced</p>
          <strong>{totalSourced}</strong>
          <span>All time</span>
        </article>
        <article className="panel">
          <p>Avg. match score</p>
          <strong>{avgMatch || "—"}</strong>
          <span>Across sourced candidates</span>
        </article>
      </div>

      {loading ? (
        <div className="panel">
          <Loader label="Loading headhunters…" />
        </div>
      ) : headhunters.length === 0 ? (
        <div className="empty-state panel">
          <h3>No headhunters yet</h3>
          <p>Create your first AI sourcing agent to start scouting the talent pool.</p>
        </div>
      ) : (
        <div className="panel candidate-table-wrap">
          <table className="table employer-table">
            <thead>
              <tr>
                <th>Headhunter</th>
                <th>Status</th>
                <th>Focus areas</th>
                <th>Sourced</th>
                <th>Last active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {headhunters.map((headhunter) => {
                const assignedTitles = headhunter.job_ids
                  .map(jobTitle)
                  .filter(Boolean);
                return (
                  <tr key={headhunter.id}>
                    <td>
                      <div className="candidate-cell">
                        <span className="headhunter-avatar">
                          {headhunterInitials(headhunter.name)}
                        </span>
                        <div>
                          <strong>{headhunter.name}</strong>
                          <small>{headhunter.persona}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`chip ${headhunterStatusChipClass(headhunter.status)}`}>
                        {headhunter.status}
                      </span>
                    </td>
                    <td>{headhunter.focus_areas.join(", ") || "—"}</td>
                    <td>
                      <span className="signal-score">
                        {headhunter.stats.candidates_sourced ?? 0}
                      </span>
                    </td>
                    <td>{timeAgo(headhunter.stats.last_active_at)}</td>
                    <td>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "flex-end" }}>
                        <Link
                          href={`/employer/headhunters/${headhunter.id}/edit`}
                          className="table-action"
                        >
                          Configure →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
