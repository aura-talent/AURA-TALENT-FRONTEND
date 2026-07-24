"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/loader";
import ReportView from "@/components/ReportView";
import ActionMenu, { type ActionMenuItem } from "@/components/employer/ActionMenu";
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
  const [activeTab, setActiveTab] = useState<"overview" | "submissions">("overview");
  const [submissionCount, setSubmissionCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (data) {
          setBounty(data);
          bountyApi
            .listSubmissionsForBounty(data.id)
            .then((subs) => {
              if (!cancelled) setSubmissionCount(subs.length);
            })
            .catch(() => {});
        } else {
          setNotFound(true);
        }
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
          {bounty.status === "draft" && (
            <button className="btn btn-primary" disabled={busy} onClick={() => transition("publish")}>
              Publish
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
          <ActionMenu
            items={[
              { type: "link", href: `/employer/bounties/${bounty.id}/edit`, label: "Edit" } satisfies ActionMenuItem,
              ...(bounty.status === "draft"
                ? [{ type: "button", label: "Delete draft", onClick: handleDelete, danger: true, disabled: busy } satisfies ActionMenuItem]
                : []),
              ...(bounty.status === "published"
                ? [{ type: "button", label: "Close bounty", onClick: () => transition("close"), disabled: busy } satisfies ActionMenuItem]
                : []),
            ]}
          />
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--ink-10)",
          marginBottom: "1.75rem",
          whiteSpace: "nowrap",
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          style={{
            padding: "0.65rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "overview" ? "2px solid var(--iris)" : "2px solid transparent",
            background: activeTab === "overview" ? "var(--iris-08)" : "transparent",
            color: activeTab === "overview" ? "var(--iris)" : "var(--ink-70)",
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            transition: "all 0.2s ease",
          }}
        >
          Overview & Rules
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("submissions")}
          style={{
            padding: "0.65rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "submissions" ? "2px solid var(--iris)" : "2px solid transparent",
            background: activeTab === "submissions" ? "var(--iris-08)" : "transparent",
            color: activeTab === "submissions" ? "var(--iris)" : "var(--ink-70)",
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            transition: "all 0.2s ease",
          }}
        >
          Submissions ({submissionCount})
        </button>
      </div>

      {activeTab === "overview" ? (
        <div className="bounty-detail-layout">
          <main>
            {bounty.rules_text ? (
              <section className="panel">
                <ReportView markdown={bounty.rules_text} />
              </section>
            ) : (
              <section className="panel">
                <p style={{ color: "var(--ink-55)" }}>No details provided.</p>
              </section>
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
      ) : (
        <div>
          {bounty.status === "draft" ? (
            <div className="panel" style={{ padding: "3rem", textAlign: "center" }}>
              <p style={{ color: "var(--ink-55)" }}>Draft bounties cannot receive submissions until published.</p>
            </div>
          ) : (
            <BountySubmissionsPanel bounty={bounty} />
          )}
        </div>
      )}
    </div>
  );
}

