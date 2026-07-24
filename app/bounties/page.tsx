"use client";

import { useEffect, useMemo, useState } from "react";
import BountyCard from "@/components/bounties/BountyCard";
import { Loader } from "@/components/ui/loader";
import { bountyApi, type Bounty } from "@/lib/bountyApi";

export default function BountyMarketplacePage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .listPublished()
      .then((data) => {
        if (!cancelled) setBounties(data);
      })
      .catch((err) => console.error("Failed to load bounties:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tags = useMemo(
    () => Array.from(new Set(bounties.flatMap((bounty) => bounty.tags))).sort(),
    [bounties],
  );
  const visible = tagFilter ? bounties.filter((b) => b.tags.includes(tagFilter)) : bounties;

  return (
    <div className="container">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Bounty marketplace</p>
          <h1>Open bounties</h1>
          <p>Real paid work from real companies. Win cash, or build a public track record.</p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="bounty-card-tags" style={{ marginBottom: "1.25rem" }}>
          <button
            className={`chip ${tagFilter === null ? "chip-tier-high" : ""}`}
            onClick={() => setTagFilter(null)}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag}
              className={`chip ${tagFilter === tag ? "chip-tier-high" : ""}`}
              onClick={() => setTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <Loader label="Loading bounties…" />
      ) : visible.length === 0 ? (
        <div className="empty-state panel">
          <h3>No open bounties right now</h3>
          <p>Check back soon — new bounties are published regularly.</p>
        </div>
      ) : (
        <div className="bounty-marketplace-grid">
          {visible.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}
