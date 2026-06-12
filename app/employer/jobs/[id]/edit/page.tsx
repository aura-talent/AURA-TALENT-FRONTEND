import { notFound } from "next/navigation";
import JobEditor from "@/components/employer/JobEditor";
import { jobs } from "../../../data";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = jobs.find((item) => item.id === id);
  if (!job) notFound();

  return <JobEditor mode="edit" initialJob={job} />;
}
