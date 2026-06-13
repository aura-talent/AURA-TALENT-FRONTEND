"use client";

import { useState } from "react";
import Link from "next/link";
import { jobs as initialJobs } from "../data";

export default function JobsPage() {
  const [jobs, setJobs] = useState(initialJobs);
  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Content and distribution</p>
          <h1>Job listings</h1>
          <p>
            Create clear roles, configure scoring priorities, and track
            conversion from view to interview.
          </p>
        </div>
        <Link className="btn btn-primary" href="/employer/jobs/new">
          ＋ Create job
        </Link>
      </div>
      <div className="job-summary-strip">
        <span>
          <b>3</b>Active
        </span>
        <span>
          <b>1</b>Draft
        </span>
        <span>
          <b>91</b>Total candidates
        </span>
        <span>
          <b>17.6%</b>Interview rate
        </span>
      </div>
      <div className="panel candidate-table-wrap">
        <table className="table employer-table jobs-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Status</th>
              <th>Applicants</th>
              <th>Interviews</th>
              <th>Mock interview</th>
              <th>Quality</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.title}>
                <td>
                  <strong>{job.title}</strong>
                  <small>{job.team}</small>
                </td>
                <td>
                  <button
                    className={`status-toggle ${job.status.toLowerCase()}`}
                    onClick={() =>
                      setJobs(
                        jobs.map((item) =>
                          item.title === job.title
                            ? {
                                ...item,
                                status:
                                  item.status === "Active" ? "Draft" : "Active",
                              }
                            : item,
                        ),
                      )
                    }
                  >
                    <i />
                    {job.status}
                  </button>
                </td>
                <td>
                  <Link
                    className="table-action"
                    href={`/employer/jobs/${job.id}/applicants`}
                  >
                    {job.candidates} view →
                  </Link>
                </td>
                <td>
                  <Link
                    className="table-action"
                    href={`/employer/jobs/${job.id}/applicants?activity=interview`}
                  >
                    {job.interviews} view →
                  </Link>
                </td>
                <td>
                  {job.mockInterviewEnabled ? (
                    <span className="chip chip-tier-high">
                      {job.interviewQuestions} questions
                    </span>
                  ) : (
                    <span className="chip">Off</span>
                  )}
                </td>
                <td>
                  {job.fit ? (
                    <span className="quality-score">{job.fit}% match</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td>
                  <div className="job-row-actions">
                    <Link
                      className="job-detail-arrow"
                      href={`/employer/jobs/${job.id}`}
                      aria-label={`View ${job.title} details`}
                    >
                      →
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="job-insight panel">
        <span className="attention-icon">✦</span>
        <div>
          <strong>Aura found an opportunity</strong>
          <p>
            Senior Product Designer has strong applicant volume, but candidates
            drop before interview. The 48-hour assessment window may be too
            short.
          </p>
        </div>
        <button className="btn btn-ghost">Review funnel</button>
      </section>
    </div>
  );
}
