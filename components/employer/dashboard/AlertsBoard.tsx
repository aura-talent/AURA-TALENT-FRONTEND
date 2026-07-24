"use client";

import { useState } from "react";
import Link from "next/link";
import SideDrawer from "@/components/drawer";
import { Loader } from "@/components/ui/loader";
import { useSuggestions, type Suggestion } from "@/app/employer/useSuggestions";

const PRIORITY_LABEL: Record<Suggestion["priority"], string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export default function AlertsBoard() {
  const { suggestions, loading, dismiss } = useSuggestions();
  const [selected, setSelected] = useState<Suggestion | null>(null);

  // Keep the open drawer's content in sync as the underlying list recomputes
  // (e.g. right after an inline action runs), and close it if the item
  // resolved/disappeared.
  const openItem = selected ? suggestions.find((s) => s.id === selected.id) ?? null : null;

  return (
    <section className="panel employer-section">
      <div className="employer-section-head">
        <div>
          <h2>Aura alerts</h2>
          <p>The highest-impact moves across your pipeline right now</p>
        </div>
        {!loading && <span className="chip chip-tier-high">{suggestions.length} alerts</span>}
      </div>

      {loading ? (
        <Loader label="Gathering alerts…" />
      ) : suggestions.length === 0 ? (
        <p style={{ color: "var(--ink-55)", fontSize: "0.85rem" }}>
          You&apos;re all caught up — Aura will surface more as your pipeline moves.
        </p>
      ) : (
        <div className="alert-board-list">
          {suggestions.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`alert-row alert-priority-${item.priority}`}
              onClick={() => setSelected(item)}
            >
              <span className="alert-row-priority">{PRIORITY_LABEL[item.priority]}</span>
              <span className="alert-row-body">
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
              </span>
              <span className="alert-row-badge">{item.badge}</span>
            </button>
          ))}
        </div>
      )}

      <SideDrawer open={!!openItem} onClose={() => setSelected(null)}>
        {openItem && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--ink-06)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
              <div style={{ minWidth: 0 }}>
                <p className="eyebrow" style={{ marginBottom: "0.4rem" }}>
                  {PRIORITY_LABEL[openItem.priority]} priority
                </p>
                <h2 style={{ fontSize: "1.1rem" }}>{openItem.title}</h2>
              </div>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>
                ✕ Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <p style={{ margin: 0, fontSize: "0.88rem", color: "var(--ink-72)", lineHeight: 1.55 }}>
                {openItem.detail}
              </p>
              {openItem.draft && (
                <div style={{ padding: "0.75rem 0.9rem", border: "1px solid var(--ink-06)", borderRadius: "var(--r-s)", background: "rgba(26,29,41,0.015)" }}>
                  <strong style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
                    {openItem.draft.subject}
                  </strong>
                  <p style={{ margin: 0, fontSize: "0.82rem", color: "var(--ink-55)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                    {openItem.draft.body}
                  </p>
                </div>
              )}
              {openItem.href && openItem.cta && (
                <Link href={openItem.href} className="table-action" onClick={() => setSelected(null)}>
                  {openItem.cta}
                </Link>
              )}
            </div>

            {openItem.action && (
              <div style={{ padding: "1rem 1.5rem", borderTop: "1px solid var(--ink-06)", display: "flex", gap: "0.6rem" }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => openItem.action!.run()}
                >
                  {openItem.action.label}
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    dismiss(openItem);
                    setSelected(null);
                  }}
                >
                  Dismiss
                </button>
              </div>
            )}
          </div>
        )}
      </SideDrawer>
    </section>
  );
}
