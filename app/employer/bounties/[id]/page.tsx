"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
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
          <p>{bounty.rules_text}</p>
        </div>
        <div className="employer-job-detail-actions">
          {bounty.status === "draft" && (
            <>
              <Link className="btn btn-ghost" href={`/employer/bounties/${bounty.id}/edit`}>
                Edit
              </Link>
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

      <div className="employer-job-facts">
        <article className="panel">
          <span>Winners</span>
          <strong>{bounty.winner_slots.length}</strong>
        </article>
        <article className="panel">
          <span>Submission mode</span>
          <strong>{bounty.submission_mode}</strong>
        </article>
        <article className="panel">
          <span>Tags</span>
          <strong>{bounty.tags.join(", ") || "—"}</strong>
        </article>
      </div>
    </div>
  );
}
