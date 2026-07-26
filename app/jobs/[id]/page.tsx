import Link from "next/link";
import { notFound } from "next/navigation";
import JobActions from "@/components/jobs/JobActions";
import MobileApplyBar from "@/components/jobs/MobileApplyBar";
import { CandidateJob } from "../mockJobs"; // Or your CandidateJob / EmployerJob type

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? "change-me";

async function getJob(jobId: string): Promise<CandidateJob> {
  const response = await fetch(
    `${BACKEND_URL}/api/v1/jobs/${encodeURIComponent(jobId)}`,
    {
      headers: {
        Accept: "application/json",
        "X-API-Key": BACKEND_API_KEY,
      },
      cache: "no-store",
    },
  );

  if (response.status === 404) notFound();
  if (!response.ok) {
    throw new Error(`Failed to fetch job ${jobId} (${response.status})`);
  }

  return response.json();
}

function formatSalary(
  low: number | null,
  high: number | null,
  currency = "USD"
): string {
  if (low === null || high === null) return "Competitive";
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${symbol}${Math.round(low / 1000)}k - ${symbol}${Math.round(high / 1000)}k`;
}

export default async function CandidateJobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const job = await getJob(id);

  // Case-insensitive status check
  if (job.status?.toLowerCase() !== "active") {
    notFound();
  }

  const companyName = job.company_name || "Aura Partner";
  const fitScore = job.fit_score ?? 90;
  const teamName = job.team || "General Team";
  const locationText = job.location || "Location Flexible";
  const employmentTypeText = job.employment_type || "Full-time";
  const descriptionText = job.description || "No description provided.";
  const salaryText = formatSalary(job.salary_low, job.salary_high, job.salary_currency);
  const interviewQuestionsCount = job.interview_questions?.length || 0;
  const keywords: string[] = job.keywords || [];

  return (
    <div className="container candidate-job-detail-page">
      <Link href="/jobs" className="back-link">
        ← Explore jobs
      </Link>
      <div className="candidate-job-detail-grid">
        <main>
          <section className="panel job-detail-hero">
            <div className="job-detail-company">
              <div className="job-company-mark large">{companyName[0]}</div>
              <div>
                <span>{companyName}</span>
                <small>{teamName}</small>
              </div>
            </div>
            <div className="job-detail-title">
              <div>
                <p className="eyebrow">
                  {employmentTypeText} · {locationText}
                </p>
                <h1>{job.title}</h1>
                <p>{descriptionText}</p>
              </div>
              <div className="job-fit-score">
                <strong>{fitScore}</strong>
                <span>% profile match</span>
              </div>
            </div>
            <div className="job-detail-facts">
              <span>
                <small>Compensation</small>
                <strong>{salaryText}</strong>
              </span>
              <span>
                <small>Posted</small>
                <strong>Recently added</strong>
              </span>
              <span>
                <small>Interview</small>
                <strong>
                  {job.mock_interview_enabled
                    ? `${interviewQuestionsCount} question simulation`
                    : "Employer review"}
                </strong>
              </span>
            </div>
          </section>

          <section className="panel job-detail-section">
            <h2>What Aura matched</h2>
            <p>
              Your profile contains evidence for the role&apos;s
              highest-priority requirements.
            </p>
            <div className="job-match-evidence">
              {keywords.map((keyword: string, index: number) => (
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
              {job.mock_interview_enabled && (
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
                <span>{job.mock_interview_enabled ? "03" : "02"}</span>
                <strong>Employer review</strong>
                <p>
                  The hiring team reviews your available evidence and contacts
                  shortlisted candidates.
                </p>
              </div>
            </div>
          </section>

          <div className="mobile-apply-spacer" aria-hidden="true" />
        </main>

        <aside>
          <section className="panel sticky-apply-card">
            <p className="eyebrow">Your fit</p>
            <h2>{fitScore}% match</h2>
            <div className="fit-breakdown">
              <span>
                <b>Skills</b>
                <i><u style={{ width: "94%" }} /></i>
                <em>94</em>
              </span>
              <span>
                <b>North Star</b>
                <i><u style={{ width: "90%" }} /></i>
                <em>90</em>
              </span>
              <span>
                <b>Compensation</b>
                <i><u style={{ width: "88%" }} /></i>
                <em>88</em>
              </span>
              <span>
                <b>Culture</b>
                <i><u style={{ width: "91%" }} /></i>
                <em>91</em>
              </span>
            </div>
            <JobActions
              jobId={job.id}
              jobTitle={job.title}
              companyName={companyName}
              mockInterviewEnabled={job.mock_interview_enabled}
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

      <MobileApplyBar
        jobId={job.id}
        jobTitle={job.title}
        companyName={companyName}
        fit={fitScore}
        mockInterviewEnabled={job.mock_interview_enabled}
      />
    </div>
  );
}
