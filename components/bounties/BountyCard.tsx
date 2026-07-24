import Link from "next/link";
import {
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

export default function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link href={`/bounties/${bounty.id}`} className="panel bounty-card">
      <div className="bounty-card-tags">
        {bounty.tags.map((tag) => (
          <span className="chip" key={tag}>
            {tag}
          </span>
        ))}
      </div>
      <h3>{bounty.title}</h3>
      <div className="bounty-card-meta">
        <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
        <span>{bounty.winner_slots.length} winners</span>
        <span>{formatDeadline(bounty.deadline)}</span>
      </div>
    </Link>
  );
}
