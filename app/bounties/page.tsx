"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import BountyCard from "@/components/bounties/BountyCard";
import { Loader } from "@/components/ui/loader";
import {
  bountyApi,
  type Bounty,
  type CandidateBountyHistory,
} from "@/lib/bountyApi";

export default function BountyMarketplacePage() {
  const { user, role, loading: authLoading } = useAuth();
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [submissions, setSubmissions] = useState<CandidateBountyHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"recent" | "submitted">("recent");

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

  useEffect(() => {
    if (!user || role !== "candidate") return;
    let cancelled = false;
    setSubmissionsLoading(true);
    bountyApi
      .listCandidateHistory(user.id)
      .then((data) => {
        if (!cancelled) setSubmissions(data);
      })
      .catch((err) => console.error("Failed to load candidate submissions:", err))
      .finally(() => {
        if (!cancelled) setSubmissionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, role]);

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
          <h1>Bounties</h1>
          <p>Real paid work from real companies. Win cash, or build a public track record.</p>
        </div>
      </div>

      {/* Two Independent Tabs */}
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
          onClick={() => setActiveTab("recent")}
          style={{
            padding: "0.65rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "recent" ? "2px solid var(--iris)" : "2px solid transparent",
            background: activeTab === "recent" ? "var(--iris-08)" : "transparent",
            color: activeTab === "recent" ? "var(--iris)" : "var(--ink-70)",
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            transition: "all 0.2s ease",
          }}
        >
          Recent Bounties
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("submitted")}
          style={{
            padding: "0.65rem 1.25rem",
            border: "none",
            borderBottom: activeTab === "submitted" ? "2px solid var(--iris)" : "2px solid transparent",
            background: activeTab === "submitted" ? "var(--iris-08)" : "transparent",
            color: activeTab === "submitted" ? "var(--iris)" : "var(--ink-70)",
            fontFamily: "var(--font-space), monospace",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            borderRadius: "4px 4px 0 0",
            transition: "all 0.2s ease",
          }}
        >
          Submitted Bounties {submissions.length > 0 ? `(${submissions.length})` : ""}
        </button>
      </div>

      {/* Tab 1: Recent Bounties */}
      {activeTab === "recent" && (
        <>
          {tags.length > 0 && (
            <div className="bounty-filter-bar">
              <button
                className={`bounty-filter-pill ${tagFilter === null ? "active" : ""}`}
                onClick={() => setTagFilter(null)}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag}
                  className={`bounty-filter-pill ${tagFilter === tag ? "active" : ""}`}
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
            <div className="panel bounty-list">
              {visible.map((bounty) => (
                <BountyCard key={bounty.id} bounty={bounty} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab 2: Submitted Bounties */}
      {activeTab === "submitted" && (
        <div>
          {!authLoading && !user && (
            <div className="notice notice-info" style={{ marginBottom: "1.5rem" }}>
              <Link href={`/login?redirect=${encodeURIComponent("/bounties")}`}>
                Sign in as a candidate
              </Link>{" "}
              to view your submitted bounties.
            </div>
          )}

          {submissionsLoading ? (
            <Loader label="Loading your submissions…" />
          ) : user && submissions.length === 0 ? (
            <div className="empty-state panel" style={{ textAlign: "center", padding: "3rem" }}>
              <h3>No submitted bounties yet</h3>
              <p style={{ color: "var(--ink-55)", marginTop: "0.5rem", marginBottom: "1.25rem" }}>
                You haven&apos;t entered any bounties yet. Browse recent bounties to get started!
              </p>
              <button className="btn btn-primary" onClick={() => setActiveTab("recent")}>
                Browse Recent Bounties
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {submissions.map((item) => {
                const isWinner = item.result?.status === "winner";
                return (
                  <div key={item.submission.id} className="panel" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                        <span className="chip" style={{ fontSize: "0.75rem" }}>
                          {item.bounty.currency} Bounty
                        </span>
                        {isWinner ? (
                          <span className="chip" style={{ background: "rgba(23, 133, 92, 0.12)", color: "var(--score-strong)", fontWeight: 700 }}>
                            🏆 Winner · Rank {item.result!.rank}
                          </span>
                        ) : item.result?.status === "not_selected" ? (
                          <span className="chip" style={{ background: "rgba(217, 83, 79, 0.12)", color: "var(--score-weak)" }}>
                            Not selected
                          </span>
                        ) : (
                          <span className="chip" style={{ background: "var(--iris-08)", color: "var(--iris)", fontWeight: 600 }}>
                            ⏳ Pending Review
                          </span>
                        )}
                      </div>

                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700 }}>
                        <Link href={`/bounties/${item.bounty.id}`} style={{ color: "var(--ink)", textDecoration: "none" }}>
                          {item.bounty.title}
                        </Link>
                      </h3>

                      <div style={{ fontSize: "0.8rem", color: "var(--ink-55)", marginTop: "0.35rem" }}>
                        Submitted on {new Date(item.submission.submitted_at).toLocaleDateString()}
                      </div>
                    </div>

                    <div>
                      <Link href={`/bounties/${item.bounty.id}`} className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
                        View Submission →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

