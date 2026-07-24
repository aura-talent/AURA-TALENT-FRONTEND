"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { bountyApi, formatPrize, type CandidateBountyHistory } from "@/lib/bountyApi";

export default function BountyCandidateHistory({
  candidateUserId,
}: {
  candidateUserId: string;
}) {
  const [history, setHistory] = useState<CandidateBountyHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .listCandidateHistory(candidateUserId)
      .then((data) => {
        if (!cancelled) setHistory(data);
      })
      .catch((err) => console.error("Failed to load bounty history:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [candidateUserId]);

  if (loading || history.length === 0) return null;

  return (
    <section className="panel employer-section profile-note">
      <h3>Bounty submissions</h3>
      {history.map(({ submission, bounty, result }) => (
        <p key={submission.id}>
          <Link href={`/bounties/${bounty.id}`}>{bounty.title}</Link>
          {result?.status === "winner"
            ? ` · Won (${formatPrize(result.prize_amount ?? 0, bounty.currency)})`
            : result?.status === "not_selected"
              ? " · Not selected"
              : " · Submitted"}
        </p>
      ))}
    </section>
  );
}
