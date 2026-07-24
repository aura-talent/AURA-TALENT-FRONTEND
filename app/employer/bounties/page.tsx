"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader } from "@/components/ui/loader";
import { useAuth } from "@/components/AuthProvider";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

function statusChipClass(status: Bounty["status"]) {
  if (status === "published") return "chip chip-tier-high";
  if (status === "closed") return "chip chip-tier-caution";
  if (status === "winners_announced") return "chip chip-tier-high";
  return "chip";
}

export default function EmployerBountiesPage() {
  const { user } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    bountyApi
      .listMine(user.id)
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
  }, [user]);

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Talent discovery</p>
          <h1>Bounties</h1>
          <p>
            Post paid tasks, discover talent through real work, and reward the
            best submissions.
          </p>
        </div>
        <Link className="btn btn-primary" href="/employer/bounties/new">
          ＋ Create bounty
        </Link>
      </div>
      <div className="panel candidate-table-wrap">
        {loading ? (
          <Loader label="Loading bounties…" />
        ) : (
          <table className="table employer-table jobs-table">
            <thead>
              <tr>
                <th>Bounty</th>
                <th>Status</th>
                <th>Prize pool</th>
                <th>Winners</th>
                <th>Deadline</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bounties.map((bounty) => (
                <tr key={bounty.id}>
                  <td>
                    <strong>{bounty.title}</strong>
                    <small>{bounty.tags.join(", ") || "—"}</small>
                  </td>
                  <td>
                    <span className={statusChipClass(bounty.status)}>
                      {bountyStatusLabel(bounty.status)}
                    </span>
                  </td>
                  <td>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)}</td>
                  <td>{bounty.winner_slots.length}</td>
                  <td>{formatDeadline(bounty.deadline)}</td>
                  <td>
                    <Link
                      className="job-detail-arrow"
                      href={`/employer/bounties/${bounty.id}`}
                      aria-label={`View ${bounty.title} details`}
                    >
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && bounties.length === 0 && (
          <div className="empty-state">
            <h3>No bounties yet</h3>
            <p>Create your first bounty to start discovering talent through real work.</p>
          </div>
        )}
      </div>
    </div>
  );
}
