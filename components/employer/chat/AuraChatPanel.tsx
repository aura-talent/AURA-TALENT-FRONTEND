"use client";

import { useEffect, useRef, useState } from "react";
import {
  employerApi,
  type ChatMessage,
  type ChatThread,
  type SuggestedAction,
} from "@/lib/employerApi";

const QUICK_ACTIONS = [
  "What needs my attention today?",
  "Summarize my hiring pipeline",
  "Which candidates should I move forward?",
];

export default function AuraChatPanel() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftsByAction, setDraftsByAction] = useState<Record<string, SuggestedAction>>({});
  const [executed, setExecuted] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const loading = open && !thread;

  // Load (or create) the standing thread + its history the first time the
  // panel opens — not on every page mount, so it costs nothing until asked.
  useEffect(() => {
    if (!open || thread) return;
    let cancelled = false;
    employerApi
      .getChatThread()
      .then(async (t) => {
        if (cancelled) return;
        setThread(t);
        const msgs = await employerApi.listChatMessages(t.id);
        if (cancelled) return;
        setMessages(msgs);
        const ids = msgs.flatMap((m) => m.proposed_action_ids);
        if (ids.length) await hydrateDrafts(ids);
      })
      .catch((err) => console.error("Failed to load Aura chat:", err));
    return () => {
      cancelled = true;
    };
  }, [open, thread]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function hydrateDrafts(ids: string[]) {
    try {
      const open_ = await employerApi.listSuggestedActions("open");
      const done = await employerApi.listSuggestedActions("done");
      const byId = Object.fromEntries([...open_, ...done].map((a) => [a.id, a]));
      setDraftsByAction((current) => ({ ...current, ...byId }));
      setExecuted((current) => {
        const next = new Set(current);
        for (const id of ids) if (byId[id]?.status === "done") next.add(id);
        return next;
      });
    } catch (err) {
      console.error("Failed to load proposed action drafts:", err);
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || !thread || sending) return;
    setInput("");
    setSending(true);
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, thread_id: thread.id, role: "user", content, proposed_action_ids: [], created_at: new Date().toISOString() },
    ]);
    try {
      const reply = await employerApi.sendChatMessage(thread.id, content);
      setMessages((current) => [...current, reply]);
      if (reply.proposed_action_ids.length) await hydrateDrafts(reply.proposed_action_ids);
    } catch (err) {
      console.error("Aura chat send failed:", err);
      setMessages((current) => [
        ...current,
        {
          id: `local-error-${Date.now()}`,
          thread_id: thread.id,
          role: "assistant",
          content: "Sorry, something went wrong sending that — try again.",
          proposed_action_ids: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  async function confirmAction(actionId: string) {
    try {
      await employerApi.executeSuggestedAction(actionId);
      setExecuted((current) => new Set(current).add(actionId));
    } catch (err) {
      console.error("Failed to execute proposed action:", err);
    }
  }

  return (
    <>
      <button
        className="aura-chat-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Aura chat" : "Open Aura chat"}
      >
        {open ? (
          "×"
        ) : (
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <defs>
              <linearGradient id="aura-chat-toggle-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c7b9ff" />
                <stop offset="50%" stopColor="#ffd9c2" />
                <stop offset="100%" stopColor="#bfead8" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="#1a1d29" />
            <circle
              cx="16"
              cy="16"
              r="9"
              fill="none"
              stroke="url(#aura-chat-toggle-grad)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="47.1"
              strokeDashoffset="7.5"
              transform="rotate(-90 16 16)"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="aura-chat-panel" role="dialog" aria-label="Ask Aura">
          <header className="aura-chat-head">
            <div>
              <strong>Ask Aura</strong>
              <span>Your HR co-pilot — she asks before sending anything.</span>
            </div>
          </header>

          <div className="aura-chat-body" ref={scrollRef}>
            {loading ? (
              <p className="aura-chat-empty">Loading…</p>
            ) : messages.length === 0 ? (
              <p className="aura-chat-empty">
                Ask about your pipeline, candidates, or what needs attention today.
              </p>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`aura-chat-msg aura-chat-msg-${m.role}`}>
                  <p>{m.content}</p>
                  {m.proposed_action_ids.map((id) => {
                    const draft = draftsByAction[id];
                    if (!draft) return null;
                    const done = executed.has(id);
                    return (
                      <div key={id} className="aura-chat-draft">
                        <strong>{draft.payload.draft_subject as string ?? draft.title}</strong>
                        <p>{(draft.payload.draft_body as string) ?? draft.body}</p>
                        <button
                          className="btn btn-primary"
                          disabled={done}
                          onClick={() => confirmAction(id)}
                        >
                          {done ? "Sent ✓" : "Confirm & send"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {sending && <p className="aura-chat-empty">Aura is thinking…</p>}
          </div>

          {messages.length === 0 && !loading && (
            <div className="aura-chat-quick">
              {QUICK_ACTIONS.map((q) => (
                <button key={q} className="aura-chat-chip" onClick={() => send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="aura-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              className="input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Aura anything about your pipeline…"
              disabled={sending || !thread}
            />
            <button className="btn btn-primary" type="submit" disabled={sending || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
