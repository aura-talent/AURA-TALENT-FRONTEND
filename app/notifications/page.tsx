"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { Loader } from "@/components/ui/loader";
import {
  fetchCandidateNotifications,
  type CandidateNotification,
} from "@/lib/notificationHelpers";

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<CandidateNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "interview" | "bounty">("all");

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchCandidateNotifications(user.id)
      .then((data) => {
        if (!cancelled) setNotifications(data);
      })
      .catch((err) => console.error("Failed to fetch notifications:", err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const filtered = filter === "all" ? notifications : notifications.filter((n) => n.type === filter);

  return (
    <div className="container" style={{ minHeight: "calc(100vh - 220px)", paddingBottom: "4rem" }}>
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">NOTIFICATIONS // INBOX</p>
          <h1>Notifications</h1>
          <p>Updates on your upcoming interview rounds, bounty entries, and portal scan matches.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          borderBottom: "1px solid var(--ink-10)",
          marginBottom: "1.5rem",
        }}
      >
        {[
          { id: "all", label: `All (${notifications.length})` },
          { id: "interview", label: `Interviews (${notifications.filter((n) => n.type === "interview").length})` },
          { id: "bounty", label: `Bounties (${notifications.filter((n) => n.type === "bounty").length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as "all" | "interview" | "bounty")}
            style={{
              padding: "0.55rem 1.1rem",
              border: "none",
              borderBottom: filter === tab.id ? "2px solid var(--iris)" : "2px solid transparent",
              background: filter === tab.id ? "var(--iris-08)" : "transparent",
              color: filter === tab.id ? "var(--iris)" : "var(--ink-70)",
              fontFamily: "var(--font-space), monospace",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              borderRadius: "4px 4px 0 0",
              transition: "all 0.2s ease",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {authLoading || loading ? (
        <Loader label="Loading notifications…" />
      ) : !user ? (
        <div className="empty-state panel" style={{ textAlign: "center", padding: "3rem" }}>
          <h3>Sign in to view notifications</h3>
          <p style={{ color: "var(--ink-55)", marginTop: "0.5rem", marginBottom: "1.25rem" }}>
            You need to be signed in to see your interview schedules and bounty updates.
          </p>
          <Link href="/login?redirect=/notifications" className="btn btn-primary">
            Sign in
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state panel" style={{ textAlign: "center", padding: "3rem" }}>
          <h3>No notifications</h3>
          <p style={{ color: "var(--ink-55)", marginTop: "0.5rem" }}>
            You don&apos;t have any updates in this category right now.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {filtered.map((item) => (
            <div
              key={item.id}
              className="panel"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem 1.25rem",
                background: "var(--surface)",
                border: "1px solid var(--ink-12)",
                borderRadius: "10px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "0.85rem", minWidth: 0, flex: 1 }}>
                <div
                  style={{
                    width: "38px",
                    height: "38px",
                    borderRadius: "50%",
                    background: item.type === "bounty" ? "rgba(99, 102, 241, 0.12)" : "rgba(16, 185, 129, 0.12)",
                    color: item.type === "bounty" ? "var(--iris)" : "#10b981",
                    display: "grid",
                    placeItems: "center",
                    fontSize: "1.1rem",
                    flexShrink: 0,
                  }}
                >
                  {item.type === "bounty" ? "🏆" : "📅"}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.2rem" }}>
                    <h4 style={{ fontSize: "0.92rem", fontWeight: 700, margin: 0, color: "var(--ink)" }}>
                      {item.title}
                    </h4>
                    <span style={{ fontSize: "0.7rem", color: "var(--ink-50)" }}>
                      {item.timestamp}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.82rem", color: "var(--ink-65)", margin: 0 }}>
                    {item.message}
                  </p>
                </div>
              </div>

              <div>
                <Link href={item.link} className="btn btn-ghost" style={{ fontSize: "0.78rem", whiteSpace: "nowrap" }}>
                  View details →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
