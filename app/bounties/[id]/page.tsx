"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import BountySubmissionView from "@/components/bounties/BountySubmissionView";
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
  type SubmissionWithResult,
} from "@/lib/bountyApi";

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, role, loading: authLoading } = useAuth();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionWithResult | null>(null);
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

      <div className="employer-job-detail-head panel">
        <div>
          <div className="employer-job-detail-meta">
            <span className="chip">{bountyStatusLabel(bounty.status)}</span>
            <span>{formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)} pool</span>
            <span>{formatDeadline(bounty.deadline)}</span>
          </div>
          <h1>{bounty.title}</h1>
          {bounty.tags.length > 0 && (
            <div className="bounty-card-tags">
              {bounty.tags.map((tag) => (
                <span className="chip" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {isOwner && (
          <div className="employer-job-detail-actions">
            <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}`}>
              Manage this bounty →
            </Link>
          </div>
        )}
      </div>

      <div className="bounty-detail-layout">
        <main>
          {bounty.rules_text && (
            <section className="panel">
              <ReportView markdown={bounty.rules_text} />
            </section>
          )}

          {!authLoading && !user && (
            <div className="notice notice-info">
              <Link href={`/login?redirect=${encodeURIComponent(`/bounties/${id}`)}`}>
                Sign in as a candidate
              </Link>{" "}
              to submit an entry.
            </div>
          )}

          {canSubmit && user && (
            mySubmission ? (
              <BountySubmissionView
                bounty={bounty}
                submission={mySubmission}
                candidateUserId={user.id}
                candidateEmail={user.email ?? ""}
                onSaved={setMySubmission}
              />
            ) : (
              <BountySubmissionForm
                bounty={bounty}
                candidateUserId={user.id}
                candidateEmail={user.email ?? ""}
                existing={null}
                onSaved={(sub) => setMySubmission({ ...sub, result: null })}
              />

            )
          )}

        </main>

        <aside>
          <section className="panel bounty-prize-card">
            <h3>Prize pool</h3>
            <div className="bounty-prize-total">
              {formatPrize(totalPrizePool(bounty.winner_slots), bounty.currency)}
              <small>{bounty.winner_slots.length} winners</small>
            </div>
            <div className="bounty-prize-ranks">
              {bounty.winner_slots.map((slot) => (
                <div className="bounty-prize-rank-row" key={slot.rank}>
                  <span>Rank {slot.rank}</span>
                  <b>{formatPrize(slot.prize_amount, bounty.currency)}</b>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>What to submit</h3>
            <div className="bounty-requirement-list">
              {bounty.requirement_items.map((item) => (
                <div className="bounty-requirement-item" key={item.id}>
                  <strong>
                    {item.label}
                    <b>
                      {item.type} · {item.required ? "required" : "optional"}
                    </b>
                  </strong>
                  {item.description && <span>{item.description}</span>}
                </div>
              ))}
              {bounty.requirement_items.length === 0 && <span>No requirements set.</span>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
