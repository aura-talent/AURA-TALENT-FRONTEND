import { headhunters } from "@/app/employer/data";

export default function HeadhunterBadge({
  headhunterId,
  compact = false,
}: {
  headhunterId: string;
  compact?: boolean;
}) {
  const headhunter = headhunters.find((item) => item.id === headhunterId);
  if (!headhunter) return null;

  return (
    <span className={`headhunter-badge ${compact ? "headhunter-badge-compact" : ""}`.trim()}>
      ✦ Sourced by {headhunter.name}
    </span>
  );
}
