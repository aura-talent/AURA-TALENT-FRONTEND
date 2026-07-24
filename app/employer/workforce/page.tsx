"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { phaseMeta, planStatusChipClass } from "../data";
import {
  employerApi,
  type EmployerJob,
  type EmployerJobPlan,
} from "@/lib/employerApi";
import { Loader } from "@/components/ui/loader";

export default function WorkforcePage() {
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [plans, setPlans] = useState<EmployerJobPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([employerApi.listJobs(), employerApi.listJobPlans()]).then(
      ([jobsRes, plansRes]) => {
        if (cancelled) return;
        if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
        if (plansRes.status === "fulfilled") setPlans(plansRes.value);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const planByJob = Object.fromEntries(plans.map((plan) => [plan.job_id, plan]));

  const plannedOpenings = plans.reduce((total, plan) => total + plan.openings, 0);
  const totalBudget = plans.reduce((total, plan) => total + (plan.budget ?? 0), 0);
  const awaitingApproval = plans.filter((plan) => plan.status === "Draft").length;
  const noPlanYet = jobs.filter((job) => !planByJob[job.id]).length;

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Planning intelligence</p>
          <h1>Workforce planning</h1>
          <p>
            Every job listing owns its own headcount and budget plan. Open a
            role to set assumptions — Aura keeps the forecast and demand
            signal current as you edit.
          </p>
        </div>
      </div>

      <div className="stat-card-row">
        <article className="panel">
          <p>Planned openings</p>
          <strong>{plannedOpenings}</strong>
          <span>Across all job listings</span>
        </article>
        <article className="panel">
          <p>Total planned budget</p>
          <strong>RM {(totalBudget / 1000).toFixed(0)}k</strong>
          <span>Annual allocation</span>
        </article>
        <article className="panel">
          <p>Awaiting approval</p>
          <strong>{awaitingApproval}</strong>
          <span>Plans still in draft</span>
        </article>
        <article className="panel">
          <p>No plan yet</p>
          <strong>{noPlanYet}</strong>
          <span>Job listings without a plan</span>
        </article>
      </div>

      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading workforce plans…" />
        ) : (
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Phase</th>
              <th>Plan status</th>
              <th>Priority</th>
              <th>Openings</th>
              <th>Budget</th>
              <th>Target fill</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const plan = planByJob[job.id];
              return (
                <tr key={job.id}>
                  <td>
                    <strong>{job.title}</strong>
                    <small>{job.team ?? "—"}</small>
                  </td>
                  <td>
                    {(() => {
                      const meta = phaseMeta(job.pipeline_phase);
                      return (
                        <span
                          className="chip"
                          style={{
                            background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                            color: meta.color,
                          }}
                        >
                          {meta.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td>
                    {plan ? (
                      <span className={`chip ${planStatusChipClass(plan.status)}`}>
                        {plan.status}
                      </span>
                    ) : (
                      <span className="signal-missing">Not started</span>
                    )}
                  </td>
                  <td>{plan?.priority ?? "—"}</td>
                  <td>{plan ? plan.openings : "—"}</td>
                  <td>
                    {plan ? (
                      <span className="signal-score">
                        RM {((plan.budget ?? 0) / 1000).toFixed(0)}k
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{plan?.target_fill_date || "—"}</td>
                  <td>
                    <Link
                      href={`/employer/workforce/${job.id}`}
                      className="table-action"
                    >
                      {plan ? "Open plan →" : "Start planning →"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
        {!loading && jobs.length === 0 && (
          <div className="empty-state">
            <h3>No jobs yet</h3>
            <p>Create a job listing to start workforce planning.</p>
          </div>
        )}
      </div>
    </div>
  );
}
