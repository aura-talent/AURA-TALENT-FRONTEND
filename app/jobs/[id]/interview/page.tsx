import Link from "next/link";
import { notFound } from "next/navigation";
import { jobs } from "../../../employer/data";

export default async function InterviewHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id && item.mockInterviewEnabled);
  if (!job) notFound();
  return (
    <div className="container interview-handoff">
      <div className="panel">
        <div className="preview-orb">
          <div className="aura-glow" />
        </div>
        <p className="eyebrow">Employer-provided simulation</p>
        <h1>{job.title} mock interview</h1>
        <p>
          {job.interviewQuestions} adaptive questions · approximately 20 minutes
          · video, voice, or text response
        </p>
        <div className="interview-readiness">
          <span>Camera and microphone check</span>
          <span>Responses can be retried during practice</span>
          <span>Only submitted attempts reach the employer</span>
        </div>
        <button className="btn btn-primary" disabled>
          Meeting experience coming soon
        </button>
        <Link className="btn btn-ghost" href={`/jobs/${job.id}`}>
          Back to job
        </Link>
      </div>
    </div>
  );
}
