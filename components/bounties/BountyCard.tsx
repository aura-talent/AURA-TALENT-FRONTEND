import Link from "next/link";
import {
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

const BOUNTY_AVATARS = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1614680376593-902f749f7cfc?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1618005198919-d3d4b5a92ead?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=120&auto=format&fit=crop&q=80",
];

export function getBountyAvatar(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % BOUNTY_AVATARS.length;
  return BOUNTY_AVATARS[index];
}

export default function BountyCard({ bounty }: { bounty: Bounty }) {
  const avatarUrl = getBountyAvatar(bounty.id);
  const prizeFormatted = formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency);

  return (
    <Link
      href={`/bounties/${bounty.id}`}
      className="bounty-card-row"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "0.85rem 1rem",
        borderRadius: "10px",
        background: "var(--surface)",
        border: "1px solid var(--ink-12)",
        textDecoration: "none",
        color: "inherit",
        transition: "all 0.2s ease",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.85rem", minWidth: 0, flex: 1 }}>
        {/* Generated Image Avatar */}
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--ink-10)",
            boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          }}
        >
          <img
            src={avatarUrl}
            alt={bounty.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Title & Meta */}
        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <h4
            style={{
              fontSize: "0.88rem",
              fontWeight: 700,
              margin: 0,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {bounty.title}
          </h4>

          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.72rem", color: "var(--ink-55)", flexWrap: "wrap" }}>
            <span>{formatDeadline(bounty.deadline)}</span>
            <span>•</span>
            <span>🏆 {bounty.winner_slots.length} winners</span>
            {bounty.tags.length > 0 && (
              <>
                <span>•</span>
                <span
                  style={{
                    fontSize: "0.63rem",
                    fontWeight: 700,
                    padding: "0.12rem 0.55rem",
                    borderRadius: "12px",
                    background: "rgba(99, 102, 241, 0.12)",
                    color: "var(--iris)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  {bounty.tags[0]}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Significant Prize Pool (No Emoji) */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div
          className="mono"
          style={{
            fontSize: "1.05rem",
            fontWeight: 800,
            color: "var(--iris)",
            letterSpacing: "-0.01em",
          }}
        >
          {prizeFormatted}
        </div>
        <span style={{ fontSize: "0.62rem", color: "var(--ink-50)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
          PRIZE POOL
        </span>
      </div>
    </Link>
  );
}


