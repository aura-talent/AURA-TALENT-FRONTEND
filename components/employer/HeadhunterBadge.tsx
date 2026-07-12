export default function HeadhunterBadge({
  name,
  compact = false,
}: {
  name: string;
  compact?: boolean;
}) {
  return (
    <span className={`headhunter-badge ${compact ? "headhunter-badge-compact" : ""}`.trim()}>
      ✦ Sourced by {name}
    </span>
  );
}
