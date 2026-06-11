import Link from "next/link";
import { notFound } from "next/navigation";
import JobActions from "@/components/jobs/JobActions";
import { jobs } from "../../employer/data";

export default async function CandidateJobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id && item.status === "Active");
  if (!job) notFound();

  return (
    <div className="container candidate-job-detail-page">
      <Link href="/jobs" className="back-link">
        ← Explore jobs
      </Link>
      <div className="candidate-job-detail-grid">
        <main>
          <section className="panel job-detail-hero">
            <div className="job-detail-company">
              <div className="job-company-mark large">N</div>
              <div>
                <span>{job.company}</span>
                <small>{job.team}</small>
              </div>
            </div>
            <div className="job-detail-title">
              <div>
                <p className="eyebrow">
                  {job.employmentType} · {job.location}
                </p>
                <h1>{job.title}</h1>
                <p>{job.description}</p>
              </div>
              <div className="job-fit-score">
                <strong>{job.fit}</strong>
                <span>% profile match</span>
              </div>
            </div>
            <div className="job-detail-facts">
              <span>
                <small>Compensation</small>
                <strong>{job.salary}</strong>
              </span>
              <span>
                <small>Posted</small>
                <strong>{job.age} ago</strong>
              </span>
              <span>
                <small>Interview</small>
                <strong>
                  {job.mockInterviewEnabled
                    ? `${job.interviewQuestions} question simulation`
                    : "Employer review"}
                </strong>
              </span>
            </div>
          </section>
          <section className="panel job-detail-section">
            <h2>What you&apos;ll own</h2>
            <ul>
              <li>
                Turn ambiguous customer and business problems into clear product
                direction.
              </li>
              <li>
                Partner closely with product, engineering, and go-to-market
                teams.
              </li>
              <li>
                Build reusable systems that improve quality and team velocity.
              </li>
              <li>Measure outcomes and iterate after launch.</li>
            </ul>
          </section>
          <section className="panel job-detail-section">
            <h2>What Aura matched</h2>
            <p>
              Your profile contains evidence for the role&apos;s
              highest-priority requirements.
            </p>
            <div className="job-match-evidence">
              {job.keywords.map((keyword, index) => (
                <span key={keyword}>
                  <i>{index < 3 ? "Strong" : "Related"}</i>
                  {keyword}
                  <b>✓</b>
                </span>
              ))}
            </div>
          </section>
          <section className="panel job-detail-section">
            <h2>Hiring process</h2>
            <div className="candidate-hiring-steps">
              <div>
                <span>01</span>
                <strong>Apply with Aura profile</strong>
                <p>
                  Your resume and matching evidence are sent to the employer.
                </p>
              </div>
              {job.mockInterviewEnabled && (
                <div>
                  <span>02</span>
                  <strong>Optional mock interview</strong>
                  <p>
                    Practice the employer-provided questions and strengthen your
                    evaluation.
                  </p>
                </div>
              )}
              <div>
                <span>{job.mockInterviewEnabled ? "03" : "02"}</span>
                <strong>Employer review</strong>
                <p>
                  The hiring team reviews your available evidence and contacts
                  shortlisted candidates.
                </p>
              </div>
            </div>
          </section>
        </main>
        <aside>
          <section className="panel sticky-apply-card">
            <p className="eyebrow">Your fit</p>
            <h2>{job.fit}% match</h2>
            <div className="fit-breakdown">
              <span>
                <b>Skills</b>
                <i>
                  <u style={{ width: "94%" }} />
                </i>
                <em>94</em>
              </span>
              <span>
                <b>North Star</b>
                <i>
                  <u style={{ width: "90%" }} />
                </i>
                <em>90</em>
              </span>
              <span>
                <b>Compensation</b>
                <i>
                  <u style={{ width: "88%" }} />
                </i>
                <em>88</em>
              </span>
              <span>
                <b>Culture</b>
                <i>
                  <u style={{ width: "91%" }} />
                </i>
                <em>91</em>
              </span>
            </div>
            <JobActions
              jobId={job.id}
              mockInterviewEnabled={job.mockInterviewEnabled}
            />
          </section>
          <section className="notice notice-info candidate-agent-note">
            <strong>Aura agent insight</strong>
            <br />
            This role advances your target trajectory and stays within your
            preferred compensation range.
          </section>
        </aside>
      </div>
    </div>
  );
}
