"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { isJobOpen } from "./data";
import { candidateInitials, employerApi, type CandidateRow, type EmployerJob } from "@/lib/employerApi";
import StageChip from "@/components/employer/StageChip";
import AlertsBoard from "@/components/employer/dashboard/AlertsBoard";
import { Loader } from "@/components/ui/loader";

function getTodayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function EmployerOverview() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listJobs(), employerApi.listCandidates()]).then(
      ([jobsRes, candidatesRes]) => {
        if (cancelled) return;
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        if (candidatesRes.status === "fulfilled") setCandidates(candidatesRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const firstName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "there")
      .split(" ")[0];

  const openRoles = jobs.filter(isJobOpen).length;
  const activeCandidates = candidates.filter(
    (row) => row.application && !row.application.is_rejected,
  ).length;
  const needsReview = candidates.filter(
    (row) => row.application && !row.evaluation,
  ).length;
  const interviewsDone = candidates.filter(
    (row) => row.evaluation?.interview_evaluation,
  ).length;

  const metrics = [
    { label: "Open roles", value: `${openRoles}`, note: `${jobs.length} total`, tone: "iris" },
    {
      label: "Active candidates",
      value: `${activeCandidates}`,
      note: needsReview ? `${needsReview} need review` : "All reviewed",
      tone: "peach",
    },
    {
      label: "Evaluations",
      value: `${candidates.filter((row) => row.evaluation).length}`,
      note: "Scored by Aura",
      tone: "mint",
    },
    {
      label: "Interviews completed",
      value: `${interviewsDone}`,
      note: "Mock interview evidence",
      tone: "iris",
    },
  ];

  const topCandidates = candidates
    .filter((row) => row.evaluation?.wlc_score != null)
    .slice(0, 3);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">{getTodayLabel()}</p>
          <h1>{getGreeting()}, {firstName}.</h1>
          <p>Here is what needs your attention across the hiring pipeline.</p>
        </div>
        <Link href="/employer/jobs/new" className="btn btn-primary">
          <span aria-hidden="true">＋</span> Create job
        </Link>
      </div>

      <div className="employer-metrics">
        {metrics.map((metric) => (
          <article className="employer-metric" key={metric.label}>
            <span className={`metric-dot ${metric.tone}`} />
            <p>{metric.label}</p>
            <strong>{loading ? "…" : metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      <AlertsBoard />

      <div className="employer-dashboard-grid">
        <section className="panel employer-section employer-span-2">
          <div className="employer-section-head">
            <div>
              <h2>Top candidates</h2>
              <p>Ranked across resume and interview signals</p>
            </div>
            <Link href="/employer/candidates">See all →</Link>
          </div>
          <div className="candidate-compact-list">
            {loading && <Loader label="Loading candidates…" />}
            {topCandidates.map((row) => (
              <Link
                href={`/employer/candidates/${row.candidate_user_id}`}
                key={`${row.job_id}-${row.candidate_user_id}`}
              >
                <span className="candidate-avatar">{candidateInitials(row.full_name)}</span>
                <div>
                  <strong>{row.full_name ?? row.email ?? "Candidate"}</strong>
                  <p>{row.job_title}</p>
                </div>
                {row.application && (
                  <StageChip stage={row.application.stage} stages={row.job_application_stages} />
                )}
                <span className="candidate-score">
                  <b>{Math.round(row.evaluation!.wlc_score!)}</b>
                  <small>match</small>
                </span>
              </Link>
            ))}
            {!loading && topCandidates.length === 0 && (
              <p style={{ color: "var(--ink-55)", fontSize: "0.85rem" }}>
                No evaluated candidates yet.
              </p>
            )}
          </div>
        </section>

        <section className="panel employer-section">
          <div className="employer-section-head">
            <div>
              <h2>Active roles</h2>
              <p>Current hiring health</p>
            </div>
            <Link href="/employer/jobs">Manage →</Link>
          </div>
          <div className="role-health-list">
            {jobs.filter(isJobOpen).slice(0, 3).map((job) => (
              <div key={job.id}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.stats?.applicant_count ?? 0} candidates</small>
                </span>
                <b>{job.stats?.interview_count ?? 0} 🎙</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
