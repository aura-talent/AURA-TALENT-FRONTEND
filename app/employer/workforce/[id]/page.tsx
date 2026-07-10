import { notFound } from "next/navigation";
import { jobs } from "@/app/employer/data";
import JobPlanEditor from "@/components/employer/workforce-planner";

export default async function JobPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();

  return <JobPlanEditor jobId={id} />;
}
