import Link from "next/link";
import { notFound } from "next/navigation";
import { candidates, jobs } from "../../../data";

export default async function JobApplicantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();
  const people = candidates.filter(
    (candidate) =>
      candidate.jobId === id &&
      (candidate.applied || candidate.interviewAttempted),
  );

  return (
    <div className="employer-page">
      <Link href="/employer/jobs" className="back-link">
        ← Job listings
      </Link>
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Applicants and interview attempts</p>
          <h1>{job.title}</h1>
          <p>
            Review candidates who applied, attempted the mock interview, or
            completed both paths.
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/employer/jobs/${job.id}/edit`}>
          Edit job setup
        </Link>
      </div>
      <div className="applicant-summary">
        <span>
          <strong>{people.filter((person) => person.applied).length}</strong>
          Applied
        </span>
        <span>
          <strong>
            {people.filter((person) => person.interviewAttempted).length}
          </strong>
          Interview attempted
        </span>
        <span>
          <strong>
            {
              people.filter(
                (person) => person.applied && person.interviewAttempted,
              ).length
            }
          </strong>
          Completed both
        </span>
      </div>
      <div className="panel candidate-table-wrap">
        <table className="table employer-table">
          <thead>
            <tr>
              <th>Candidate</th>
              <th>Participation</th>
              <th>Application</th>
              <th>Interview</th>
              <th>Current score</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {people.map((candidate) => (
              <tr key={candidate.id}>
                <td>
                  <div className="candidate-cell">
                    <span className="candidate-avatar">
                      {candidate.initials}
                    </span>
                    <div>
                      <strong>{candidate.name}</strong>
                      <small>
                        {candidate.location} · {candidate.experience}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="candidate-activity">
                    {candidate.applied && (
                      <span className="chip chip-tier-high">Applied</span>
                    )}
                    {candidate.interviewAttempted && (
                      <span className="chip">Interview attempted</span>
                    )}
                  </div>
                </td>
                <td>
                  {candidate.applied ? (
                    <span className="completion-check">Complete</span>
                  ) : (
                    <span className="signal-missing">Not applied</span>
                  )}
                </td>
                <td>
                  {candidate.interviewAttempted ? (
                    <span className="completion-check">
                      {candidate.interview}/100
                    </span>
                  ) : (
                    <span className="signal-missing">Optional · pending</span>
                  )}
                </td>
                <td>
                  <div className="match-cell">
                    <b>{candidate.score}%</b>
                    <span>
                      <i style={{ width: `${candidate.score}%` }} />
                    </span>
                  </div>
                </td>
                <td>
                  <Link
                    href={`/employer/candidates/${candidate.id}`}
                    className="table-action"
                  >
                    Evaluate →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 && (
          <div className="empty-state">
            <h3>No activity yet</h3>
            <p>Applicants and mock interview attempts will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
