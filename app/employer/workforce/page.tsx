import Link from "next/link";
import { jobPlans, jobs, planStatusChipClass } from "../data";

export default function WorkforcePage() {
  const plannedOpenings = jobs.reduce(
    (total, job) => total + (jobPlans[job.id]?.openings ?? 0),
    0,
  );
  const totalBudget = jobs.reduce(
    (total, job) => total + (jobPlans[job.id]?.budget ?? 0),
    0,
  );
  const awaitingApproval = jobs.filter(
    (job) => jobPlans[job.id]?.status === "Draft",
  ).length;
  const noPlanYet = jobs.filter((job) => !jobPlans[job.id]).length;

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
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Job status</th>
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
              const plan = jobPlans[job.id];
              return (
                <tr key={job.id}>
                  <td>
                    <strong>{job.title}</strong>
                    <small>{job.team}</small>
                  </td>
                  <td>
                    <span className={`chip ${job.status === "Active" ? "chip-tier-high" : ""}`}>
                      {job.status}
                    </span>
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
                  <td>{plan ? plan.priority : "—"}</td>
                  <td>{plan ? plan.openings : "—"}</td>
                  <td>
                    {plan ? (
                      <span className="signal-score">
                        RM {(plan.budget / 1000).toFixed(0)}k
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{plan?.targetFillDate || "—"}</td>
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
      </div>
    </div>
  );
}
