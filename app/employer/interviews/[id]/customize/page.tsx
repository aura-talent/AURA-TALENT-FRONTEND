import { notFound } from "next/navigation";
import InterviewEditor from "@/components/employer/InterviewEditor";
import { jobs } from "../../../data";

export default async function CustomizeInterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id);

  if (!job) notFound();

  return <InterviewEditor initialRole={job.title} />;
}
