"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import ReportView from "@/components/ReportView";
import BountySubmissionsPanel from "@/components/employer/BountySubmissionsPanel";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  totalPrizePool,
  type Bounty,
} from "@/lib/bountyApi";

export default function EmployerBountyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (data) setBounty(data);
        else setNotFound(true);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function transition(action: "publish" | "close" | "announceWinners") {
    if (!bounty) return;
    setBusy(true);
    try {
      if (action === "announceWinners") {
        await bountyApi.announceWinners(bounty.id);
      }
      const updated =
        action === "publish"
          ? await bountyApi.publish(bounty.id)
          : action === "close"
            ? await bountyApi.close(bounty.id)
            : await bountyApi.getById(bounty.id);
      if (updated) setBounty(updated);
    } catch (err) {
      console.error(`Failed to ${action} bounty:`, err);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!bounty) return;
    if (!window.confirm("Delete this draft bounty? This can't be undone.")) return;
    setBusy(true);
    try {
      await bountyApi.deleteDraft(bounty.id);
      router.push("/employer/bounties");
    } catch (err) {
      console.error("Failed to delete bounty:", err);
      setBusy(false);
    }
  }

  if (notFound)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
        </div>
      </div>
    );
  if (!bounty)
    return (
      <div className="employer-page">
        <Loader label="Loading bounty…" />
      </div>
    );

  return (
    <div className="employer-page">
      <Link href="/employer/bounties" className="back-link">
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
        <div className="employer-job-detail-actions">
          <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}/edit`}>
            Edit
          </Link>
          {bounty.status === "draft" && (
            <>
              <button className="btn btn-primary" disabled={busy} onClick={() => transition("publish")}>
                Publish
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={handleDelete}>
                Delete draft
              </button>
            </>
          )}
          {bounty.status === "published" && (
            <button className="btn btn-ghost" disabled={busy} onClick={() => transition("close")}>
              Close bounty
            </button>
          )}
          {bounty.status === "closed" && (
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => transition("announceWinners")}
            >
              Announce winners
            </button>
          )}
        </div>
      </div>

      <div className="bounty-detail-layout">
        <main>
          {bounty.rules_text && (
            <section className="panel">
              <ReportView markdown={bounty.rules_text} />
            </section>
          )}
          {bounty.status !== "draft" && <BountySubmissionsPanel bounty={bounty} />}
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
            <h3>Submission requirements</h3>
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

          <section className="panel">
            <h3>Details</h3>
            <div className="bounty-requirement-list">
              <div className="bounty-requirement-item">
                <strong>Submission mode</strong>
                <span>{bounty.submission_mode}</span>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
