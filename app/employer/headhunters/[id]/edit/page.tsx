import { notFound } from "next/navigation";
import { headhunters } from "@/app/employer/data";
import HeadhunterEditor from "@/components/employer/headhunter-editor";

export default async function EditHeadhunterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const headhunter = headhunters.find((item) => item.id === id);
  if (!headhunter) notFound();

  return <HeadhunterEditor mode="edit" initialHeadhunter={headhunter} />;
}
