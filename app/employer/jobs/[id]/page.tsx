import Link from "next/link";
import { notFound } from "next/navigation";
import {
  jobs,
  talentPoolCandidates,
  talentPoolProfiles,
} from "../../data";

function recommendationScore(
  candidate: (typeof talentPoolCandidates)[number],
  job: (typeof jobs)[number],
) {
  const evidence = new Set(
    [...candidate.skills, ...candidate.matchedKeywords].map((value) =>
      value.toLowerCase(),
    ),
  );
  const matches = job.keywords.filter((keyword) =>
    evidence.has(keyword.toLowerCase()),
  );
  const skillScore = Math.round((matches.length / job.keywords.length) * 100);
  const overall = Math.round(candidate.score * 0.65 + skillScore * 0.35);
  return { matches, overall };
}

export default async function EmployerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();

  const recommendations = talentPoolCandidates
    .map((candidate) => ({
      candidate,
      profile: talentPoolProfiles[candidate.id],
      ...recommendationScore(candidate, job),
    }))
    .sort((a, b) => b.overall - a.overall);

  return (
    <div className="employer-page">
      <Link href="/employer/jobs" className="back-link">← Job listings</Link>

      <div className="employer-job-detail-head panel">
        <div>
          <div className="employer-job-detail-meta">
            <span className={`chip ${job.status === "Active" ? "chip-tier-high" : ""}`}>
              {job.status}
            </span>
            <span>{job.team}</span>
            <span>{job.age}</span>
          </div>
          <h1>{job.title}</h1>
          <p>{job.description}</p>
        </div>
        <div className="employer-job-detail-actions">
          <Link className="btn btn-ghost" href={`/employer/jobs/${job.id}/applicants`}>
            View applicants
          </Link>
          <Link className="btn btn-primary" href={`/employer/jobs/${job.id}/edit`}>
            Edit job
          </Link>
        </div>
      </div>

      <div className="employer-job-facts">
        <article className="panel"><span>Location</span><strong>{job.location}</strong></article>
        <article className="panel"><span>Employment</span><strong>{job.employmentType}</strong></article>
        <article className="panel"><span>Compensation</span><strong>{job.salary}</strong></article>
        <article className="panel"><span>Current quality</span><strong>{job.fit}% match</strong></article>
      </div>

      <div className="employer-job-detail-grid">
        <main>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Role configuration</p>
                <h2>Priority evidence</h2>
                <p>Skills and signals used to evaluate new and previous candidates.</p>
              </div>
            </div>
            <div className="job-match-evidence">
              {job.keywords.map((keyword, index) => (
                <span key={keyword}><i>{index < 3 ? "Priority" : "Matched"}</i>{keyword}</span>
              ))}
            </div>
          </section>

          <section className="panel employer-section talent-recommendations">
            <div className="employer-section-head">
              <div>
                <p className="eyebrow">Aura talent recall</p>
                <h2>Recommended from your talent pool</h2>
                <p>Strong former candidates who may fit this newly available role.</p>
              </div>
              <Link href="/employer/talent-pool">View talent pool →</Link>
            </div>
            <div className="talent-recommendation-list">
              {recommendations.map(({ candidate, profile, matches, overall }) => (
                <article key={candidate.id}>
                  <span className="candidate-avatar">{candidate.initials}</span>
                  <div>
                    <header>
                      <div>
                        <strong>{candidate.name}</strong>
                        <small>{profile.previousOutcome}</small>
                      </div>
                      <span className="quality-score">{overall}% renewed fit</span>
                    </header>
                    <p>
                      {matches.length
                        ? `Aura found prior evidence for ${matches.join(", ")}.`
                        : `Aura sees transferable evidence and recommends a human review.`}
                    </p>
                    <footer>
                      <span>{profile.availableFrom}</span>
                      <Link href={`/employer/candidates/${candidate.id}`}>Review and reconnect →</Link>
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">Hiring activity</p>
            <div className="job-detail-stat"><strong>{job.candidates}</strong><span>Candidates</span></div>
            <div className="job-detail-stat"><strong>{job.interviews}</strong><span>Interviews</span></div>
            <div className="job-detail-stat"><strong>{job.interviewQuestions}</strong><span>Interview questions</span></div>
          </section>
          <section className="panel employer-section talent-recall-note">
            <span className="attention-icon">✦</span>
            <h3>Why talent recall matters</h3>
            <p>These candidates already invested in your hiring process. Re-engagement starts with context, consent, and a warmer conversation.</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
