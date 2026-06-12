import Link from "next/link";
import { notFound } from "next/navigation";
import { candidates, jobs } from "../../../data";

export default async function JobApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ activity?: string | string[] }>;
}) {
  const { id } = await params;
  const { activity } = await searchParams;
  const interviewOnly = activity === "interview";
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();
  const allPeople = candidates.filter(
    (candidate) =>
      candidate.jobId === id &&
      (candidate.applied || candidate.interviewAttempted),
  );
  const people = interviewOnly
    ? allPeople.filter((candidate) => candidate.interviewAttempted)
    : allPeople;

  return (
    <div className="employer-page">
      <Link href="/employer/jobs" className="back-link">
        ← Job listings
      </Link>
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {interviewOnly
              ? "Mock interview attempts"
              : "Applicants and interview attempts"}
          </p>
          <h1>{job.title}</h1>
          <p>
            {interviewOnly
              ? "Review candidates who attempted this role's mock interview and open their interview evaluation."
              : "Review candidates who applied, attempted the mock interview, or completed both paths."}
          </p>
        </div>
        <Link className="btn btn-ghost" href={`/employer/jobs/${job.id}/edit`}>
          Edit job setup
        </Link>
      </div>
      <div className="candidate-view-tabs" aria-label="Candidate activity view">
        <Link
          className={!interviewOnly ? "active" : ""}
          href={`/employer/jobs/${job.id}/applicants`}
        >
          All activity
        </Link>
        <Link
          className={interviewOnly ? "active" : ""}
          href={`/employer/jobs/${job.id}/applicants?activity=interview`}
        >
          Interview attempts
        </Link>
      </div>
      <div className="applicant-summary">
        <span>
          <strong>{allPeople.filter((person) => person.applied).length}</strong>
          Applied
        </span>
        <span>
          <strong>
            {allPeople.filter((person) => person.interviewAttempted).length}
          </strong>
          Interview attempted
        </span>
        <span>
          <strong>
            {
              allPeople.filter(
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
                    <Link
                      className="completion-check"
                      href={`/employer/candidates/${candidate.id}/interview`}
                    >
                      {candidate.interview}/100
                    </Link>
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
                    href={
                      interviewOnly
                        ? `/employer/candidates/${candidate.id}/interview`
                        : `/employer/candidates/${candidate.id}`
                    }
                    className="table-action"
                  >
                    {interviewOnly ? "View interview →" : "Evaluate →"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {people.length === 0 && (
          <div className="empty-state">
            <h3>No activity yet</h3>
            <p>
              {interviewOnly
                ? "Completed mock interview attempts will appear here."
                : "Applicants and mock interview attempts will appear here."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
