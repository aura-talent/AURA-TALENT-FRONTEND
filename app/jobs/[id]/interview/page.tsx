import Link from "next/link";
import { notFound } from "next/navigation";
import type { CandidateJob } from "../../mockJobs";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";
const BACKEND_API_KEY = process.env.BACKEND_API_KEY ?? "change-me";

async function getInterviewJob(jobId: string): Promise<CandidateJob> {
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

export default async function InterviewHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await getInterviewJob(id);

  if (!job.mock_interview_enabled) notFound();

  const questionCount = job.interview_questions?.length ?? 0;
  const mockInterviewHref = `/mock-interview?role=${encodeURIComponent(job.title)}`;

  return (
    <div className="container interview-handoff">
      <div className="panel">
        <div className="preview-orb">
          <div className="aura-glow" />
        </div>
        <p className="eyebrow">Employer-provided simulation</p>
        <h1>{job.title} mock interview</h1>
        <p>
          {questionCount} adaptive questions &middot; approximately 20 minutes
          &middot; video, voice, or text response
        </p>
        <div className="interview-readiness">
          <span>Camera and microphone check</span>
          <span>Responses can be retried during practice</span>
          <span>Only submitted attempts reach the employer</span>
        </div>
        <Link className="btn btn-primary" href={mockInterviewHref}>
          Start {job.title} mock interview
        </Link>
        <Link className="btn btn-ghost" href={`/jobs/${job.id}`}>
          Back to job
        </Link>
      </div>
    </div>
  );
}
