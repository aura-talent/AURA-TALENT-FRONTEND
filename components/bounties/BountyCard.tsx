import Link from "next/link";
import {
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

export default function BountyCard({ bounty }: { bounty: Bounty }) {
  return (
    <Link href={`/bounties/${bounty.id}`} className="bounty-list-row">
      <div className="bounty-list-row-main">
        <h3>{bounty.title}</h3>
        <div className="bounty-list-row-meta">
          <span>{bounty.winner_slots.length} winners</span>
          <span>{formatDeadline(bounty.deadline)}</span>
          {bounty.tags.slice(0, 3).map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="bounty-list-row-prize">
        <strong>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)}</strong>
        <span>total prize</span>
      </div>
    </Link>
  );
}
