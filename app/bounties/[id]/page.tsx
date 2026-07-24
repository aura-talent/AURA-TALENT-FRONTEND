"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import BountySubmissionForm from "@/components/bounties/BountySubmissionForm";
import ReportView from "@/components/ReportView";
import { Loader } from "@/components/ui/loader";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
  type BountySubmission,
} from "@/lib/bountyApi";

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, role, loading: authLoading } = useAuth();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [mySubmission, setMySubmission] = useState<BountySubmission | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setNotFound(true);
          return;
        }
        setBounty(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!bounty || !user || role !== "candidate") return;
    let cancelled = false;
    bountyApi
      .getMySubmission(bounty.id, user.id)
      .then((data) => {
        if (!cancelled) setMySubmission(data);
      })
      .catch((err) => console.error("Failed to load submission:", err));
    return () => {
      cancelled = true;
    };
  }, [bounty, user, role]);

  if (notFound)
    return (
      <div className="container">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
        </div>
      </div>
    );
  if (loading || !bounty)
    return (
      <div className="container">
        <Loader label="Loading bounty…" />
      </div>
    );

  const isOwner = user?.id === bounty.employer_id;
  const canSubmit = role === "candidate" && bounty.status === "published";

  return (
    <div className="container">
      <Link href="/bounties" className="back-link">
        ← All bounties
      </Link>

      <div className="panel">
        <div className="employer-job-detail-meta">
          <span className="chip">{bountyStatusLabel(bounty.status)}</span>
          <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
          <span>{formatDeadline(bounty.deadline)}</span>
        </div>
        <h1>{bounty.title}</h1>
        <div className="bounty-card-tags">
          {bounty.tags.map((tag) => (
            <span className="chip" key={tag}>
              {tag}
            </span>
          ))}
        </div>
        {bounty.rules_text && <ReportView markdown={bounty.rules_text} />}

        <h3>Prizes</h3>
        <ul>
          {bounty.winner_slots.map((slot) => (
            <li key={slot.rank}>
              Rank {slot.rank}: {formatPrize(slot.prize_amount, bounty.currency)}
            </li>
          ))}
        </ul>

        <h3>What to submit</h3>
        <ul>
          {bounty.requirement_items.map((item) => (
            <li key={item.id}>
              <strong>{item.label}</strong> ({item.type}
              {item.required ? ", required" : ", optional"})
              {item.description && ` — ${item.description}`}
            </li>
          ))}
        </ul>

        {isOwner && (
          <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}`}>
            Manage this bounty →
          </Link>
        )}
      </div>

      {!authLoading && !user && (
        <div className="notice notice-info">
          <Link href={`/login?redirect=${encodeURIComponent(`/bounties/${id}`)}`}>
            Sign in as a candidate
          </Link>{" "}
          to submit an entry.
        </div>
      )}

      {canSubmit && user && (
        <BountySubmissionForm
          bounty={bounty}
          candidateUserId={user.id}
          candidateEmail={user.email ?? ""}
          existing={mySubmission}
          onSaved={setMySubmission}
        />
      )}
    </div>
  );
}
