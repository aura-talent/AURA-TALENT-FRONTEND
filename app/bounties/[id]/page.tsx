"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import BountySubmissionView from "@/components/bounties/BountySubmissionView";
import BountySubmissionForm from "@/components/bounties/BountySubmissionForm";
import { getBountyAvatar } from "@/components/bounties/BountyCard";
import ReportView from "@/components/ReportView";
import { Loader } from "@/components/ui/loader";
import {
  bountyApi,
  bountyStatusLabel,
  formatDeadline,
  formatPrize,
  formatRankLabel,
  totalPrizePool,
  type Bounty,
  type SubmissionWithResult,
} from "@/lib/bountyApi";



import { supabase } from "@/lib/supabaseClient";

function LiveCountdown({ deadline }: { deadline: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    expired: boolean;
  } | null>(null);

  useEffect(() => {
    if (!deadline) return;

    function calculate() {
      const target = new Date(deadline!).getTime();
      const now = Date.now();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, expired: true });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);

      setTimeLeft({ days, hours, minutes, seconds, expired: false });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (!deadline) return null;

  return (
    <section className="panel" style={{ padding: "1.25rem", borderRadius: "10px" }}>
      <div
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color: "var(--ink-50)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.85rem",
        }}
      >
        <span>{timeLeft?.expired ? "Bounty Status" : "Submissions Close In"}</span>
      </div>


      {timeLeft?.expired ? (
        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--score-weak)" }}>
          Submissions Closed
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem", textAlign: "center" }}>
          {[
            { label: "DAYS", value: timeLeft?.days ?? 0 },
            { label: "HOURS", value: timeLeft?.hours ?? 0 },
            { label: "MINS", value: timeLeft?.minutes ?? 0 },
            { label: "SECS", value: timeLeft?.seconds ?? 0 },
          ].map((unit) => (
            <div
              key={unit.label}
              style={{
                background: "var(--ink-04)",
                border: "1px solid var(--ink-10)",
                borderRadius: "8px",
                padding: "0.55rem 0.2rem",
              }}
            >
              <div
                className="mono"
                style={{
                  fontSize: "1.1rem",
                  fontWeight: 800,
                  color: "var(--iris)",
                  lineHeight: 1.1,
                }}
              >
                {String(unit.value).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontSize: "0.55rem",
                  fontWeight: 700,
                  color: "var(--ink-50)",
                  marginTop: "0.2rem",
                  letterSpacing: "0.04em",
                }}
              >
                {unit.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function BountyDetailPage({ params }: { params: Promise<{ id: string }> }) {

  const { id } = use(params);
  const { user, role, loading: authLoading } = useAuth();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [mySubmission, setMySubmission] = useState<SubmissionWithResult | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
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
    if (!bounty?.employer_id) return;
    let cancelled = false;
    async function fetchEmployerCompany() {
      try {
        const { data } = await supabase
          .from("employer_profiles")
          .select("company_name")
          .eq("user_id", bounty!.employer_id)
          .maybeSingle();
        if (!cancelled && data?.company_name) {
          setCompanyName(data.company_name);
        }
      } catch {
        /* Ignore error */
      }
    }
    void fetchEmployerCompany();
    return () => {
      cancelled = true;
    };
  }, [bounty?.employer_id]);



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
  const avatarUrl = getBountyAvatar(bounty.id);

  return (
    <div className="container">
      <Link href="/bounties" className="back-link">
        ← All bounties
      </Link>

      <div
        className="employer-job-detail-head panel"
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "1.25rem",
          padding: "1.75rem",
        }}
      >
        {/* Top-Right Category Tags */}
        {bounty.tags.length > 0 && (
          <div style={{ position: "absolute", top: "1.25rem", right: "1.25rem", display: "flex", gap: "0.45rem" }}>
            {bounty.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  padding: "0.18rem 0.7rem",
                  borderRadius: "12px",
                  background: "rgba(99, 102, 241, 0.12)",
                  color: "var(--iris)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Vertically Centered Avatar Thumbnail Image */}
        <div
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "12px",
            overflow: "hidden",
            flexShrink: 0,
            background: "var(--ink-10)",
            boxShadow: "0 3px 10px rgba(0,0,0,0.12)",
          }}
        >
          <img
            src={avatarUrl}
            alt={bounty.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>

        {/* Title & Employer Metadata */}
        <div style={{ minWidth: 0, flex: 1, paddingRight: isOwner ? "10rem" : "5rem" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-55)", marginBottom: "0.25rem", fontWeight: 600 }}>
            {formatDeadline(bounty.deadline)}
          </div>

          <h1 style={{ fontSize: "1.75rem", margin: "0 0 0.4rem 0", lineHeight: 1.25, fontWeight: 700 }}>
            {bounty.title}
          </h1>

          {/* Employer Name with Verified Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--ink-60)", fontWeight: 600 }}>
            <span>{companyName || "Aura Malaysia"}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#3b82f6">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>

        </div>

        {isOwner && (
          <div className="employer-job-detail-actions" style={{ position: "absolute", bottom: "1.25rem", right: "1.25rem" }}>
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
                  <span>{formatRankLabel(slot.rank)}</span>

                  <b>{formatPrize(slot.prize_amount, bounty.currency)}</b>
                </div>
              ))}
            </div>
          </section>

          <LiveCountdown deadline={bounty.deadline} />

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
