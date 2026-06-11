"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { candidates, jobs } from "./data";

const metrics = [
  { label: "Open roles", value: "4", note: "+1 this month", tone: "iris" },
  {
    label: "Active candidates",
    value: "91",
    note: "18 need review",
    tone: "peach",
  },
  {
    label: "Avg. time to hire",
    value: "18d",
    note: "6 days faster",
    tone: "mint",
  },
  {
    label: "Interview completion",
    value: "84%",
    note: "+9% this quarter",
    tone: "iris",
  },
];

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
  const router = useRouter();

  const firstName =
    (user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email ?? "there")
      .split(" ")[0];

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">{getTodayLabel()}</p>
          <h1>{getGreeting()}, {firstName}.</h1>
          <p>Here is what needs your attention across the hiring pipeline.</p>
        </div>
        <Link href="/employer/jobs" className="btn btn-primary">
          <span aria-hidden="true">＋</span> Create job
        </Link>
      </div>

      <div className="employer-metrics">
        {metrics.map((metric) => (
          <article className="employer-metric" key={metric.label}>
            <span className={`metric-dot ${metric.tone}`} />
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <small>{metric.note}</small>
          </article>
        ))}
      </div>

      <div className="employer-dashboard-grid">
        <section className="panel employer-section employer-span-2">
          <div className="employer-section-head">
            <div>
              <h2>Hiring pipeline</h2>
              <p>Candidate movement across all active roles</p>
            </div>
            <Link href="/employer/candidates">View candidates →</Link>
          </div>
          <div className="pipeline">
            {[
              { label: "Applied", value: 91 },
              { label: "AI screened", value: 54 },
              { label: "Interview", value: 21 },
              { label: "Final review", value: 8 },
              { label: "Offer", value: 3 },
            ].map((step, index) => (
              <div className="pipeline-step" key={step.label}>
                <div
                  className="pipeline-bar"
                  style={{ height: `${42 + step.value * 0.75}px` }}
                >
                  <span>{step.value}</span>
                </div>
                <p>{step.label}</p>
                {index < 4 && <span className="pipeline-arrow">→</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="panel employer-section">
          <div className="employer-section-head">
            <div>
              <h2>AI attention</h2>
              <p>Actions with the highest impact</p>
            </div>
          </div>
          <div className="attention-list">
            <Link href="/employer/candidates">
              <span className="attention-icon">18</span>
              <div>
                <strong>Candidates ready to review</strong>
                <p>7 are high-confidence matches</p>
              </div>
              <b>→</b>
            </Link>
            <Link href="/employer/interviews">
              <span className="attention-icon warm">4</span>
              <div>
                <strong>Interviews completed</strong>
                <p>Scorecards are ready</p>
              </div>
              <b>→</b>
            </Link>
            <Link href="/employer/workforce">
              <span className="attention-icon green">1</span>
              <div>
                <strong>Hiring risk detected</strong>
                <p>Engineering demand is rising</p>
              </div>
              <b>→</b>
            </Link>
          </div>
        </section>

        <section className="panel employer-section employer-span-2">
          <div className="employer-section-head">
            <div>
              <h2>Top candidates</h2>
              <p>Ranked across resume and interview signals</p>
            </div>
            <Link href="/employer/candidates">See all →</Link>
          </div>
          <div className="candidate-compact-list">
            {candidates.slice(0, 3).map((candidate) => (
              <Link
                href={`/employer/candidates/${candidate.id}`}
                key={candidate.id}
              >
                <span className="candidate-avatar">{candidate.initials}</span>
                <div>
                  <strong>{candidate.name}</strong>
                  <p>{candidate.role}</p>
                </div>
                <span className="chip">{candidate.stage}</span>
                <span className="candidate-score">
                  <b>{candidate.score}</b>
                  <small>match</small>
                </span>
              </Link>
            ))}
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
            {jobs.slice(0, 3).map((job) => (
              <div key={job.title}>
                <span>
                  <strong>{job.title}</strong>
                  <small>{job.candidates} candidates</small>
                </span>
                <b>{job.fit}%</b>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
