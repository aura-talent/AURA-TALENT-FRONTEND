import Link from "next/link";
import { candidates, jobs } from "../data";

export default function InterviewsPage() {
  const managedInterviews = jobs.filter(
    (job) => job.status === "Active" && job.mockInterviewEnabled,
  );

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Interview management</p>
          <h1>Mock interviews</h1>
          <p>
            Manage every interview attached to an open role, review activity,
            and customize the candidate experience.
          </p>
        </div>
      </div>

      <div className="interview-management-summary">
        <article className="panel">
          <p>Active interviews</p>
          <strong>{managedInterviews.length}</strong>
          <span>Across open roles</span>
        </article>
        <article className="panel">
          <p>Total attempts</p>
          <strong>
            {
              candidates.filter((candidate) => candidate.interviewAttempted)
                .length
            }
          </strong>
          <span>Candidate submissions</span>
        </article>
        <article className="panel">
          <p>Completion rate</p>
          <strong>84%</strong>
          <span>Up 9% this quarter</span>
        </article>
      </div>

      <div className="interview-management-grid">
        {managedInterviews.map((job) => {
          const roleCandidates = candidates.filter(
            (candidate) => candidate.jobId === job.id,
          );
          const attempted = roleCandidates.filter(
            (candidate) => candidate.interviewAttempted,
          ).length;

          return (
            <article className="panel interview-management-card" key={job.id}>
              <header>
                <div className="job-company-mark">N</div>
                <div>
                  <span>{job.team}</span>
                  <small>Active role</small>
                </div>
                <span className="chip chip-tier-high">Live</span>
              </header>

              <h2>{job.title}</h2>
              <p>
                {job.interviewQuestions} adaptive questions · video, voice, or
                text response
              </p>

              <div className="interview-card-stats">
                <span>
                  <strong>{attempted}</strong>
                  Attempts
                </span>
                <span>
                  <strong>{roleCandidates.length}</strong>
                  Candidates
                </span>
                <span>
                  <strong>{attempted ? "88" : "—"}</strong>
                  Avg. score
                </span>
              </div>

              <footer>
                <Link
                  href={`/employer/jobs/${job.id}/applicants`}
                  className="btn btn-ghost"
                >
                  View candidates
                </Link>
                <Link
                  href={`/employer/interviews/${job.id}/customize`}
                  className="btn btn-primary"
                >
                  Customize
                </Link>
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}
