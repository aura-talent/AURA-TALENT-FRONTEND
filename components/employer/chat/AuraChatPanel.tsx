"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  employerApi,
  type ChatMessage,
  type ChatProgressEvent,
  type ChatThread,
  type SuggestedAction,
} from "@/lib/employerApi";

const QUICK_ACTIONS = [
  "What needs my attention today?",
  "Summarize my hiring pipeline",
  "Which candidates should I move forward?",
];

/** What a proposal is actually asking for, said plainly. */
const PROPOSAL_KIND: Record<string, string> = {
  send_interview_invite: "Interview invitation",
  follow_up: "Follow-up email",
  recommend_offer: "Offer email",
};

/** Matches the nav's icon set — 24px grid, 1.75 stroke, round caps. */
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "history" && (
        <>
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
          <path d="M3 4v4h4" />
          <path d="M12 8v4l2.5 2" />
        </>
      )}
      {name === "plus" && <path d="M12 5v14M5 12h14" />}
      {name === "expand" && <path d="M9 4H4v5M15 20h5v-5" />}
      {name === "collapse" && <path d="M4 9h5V4M20 15h-5v5" />}
      {name === "close" && <path d="M6 6l12 12M18 6L6 18" />}
      {name === "trash" && (
        <>
          <path d="M4 7h16M10 11v6M14 11v6" />
          <path d="M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12" />
          <path d="M9 7V4h6v3" />
        </>
      )}
      {name === "send" && <path d="M5 12h13M12 5l7 7-7 7" />}
    </svg>
  );
}

export default function AuraChatPanel() {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draftsByAction, setDraftsByAction] = useState<Record<string, SuggestedAction>>({});
  const [settled, setSettled] = useState<Record<string, "sent" | "declined">>({});
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [progressSteps, setProgressSteps] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loading = open && !activeThreadId;

  // Load every session + the most recent one's history the first time the
  // panel opens — not on every page mount, so it costs nothing until asked.
  useEffect(() => {
    if (!open || activeThreadId) return;
    let cancelled = false;
    employerApi
      .listChatThreads()
      .then(async (list) => {
        if (cancelled) return;
        if (!list.length) list = [await employerApi.createChatThread()];
        if (cancelled) return;
        setThreads(list);
        setActiveThreadId(list[0].id);
        const msgs = await employerApi.listChatMessages(list[0].id);
        if (cancelled) return;
        setMessages(msgs);
        const ids = msgs.flatMap((m) => m.proposed_action_ids);
        if (ids.length) await hydrateDrafts(ids);
      })
      .catch((err) => console.error("Failed to load Aura chat:", err));
    return () => {
      cancelled = true;
    };
  }, [open, activeThreadId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, progressSteps]);

  // Grow the composer with its content, up to the CSS max-height.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  async function hydrateDrafts(ids: string[]) {
    try {
      const [open_, done, dismissed] = await Promise.all([
        employerApi.listSuggestedActions("open"),
        employerApi.listSuggestedActions("done"),
        employerApi.listSuggestedActions("dismissed"),
      ]);
      const byId = Object.fromEntries(
        [...open_, ...done, ...dismissed].map((a) => [a.id, a]),
      );
      setDraftsByAction((current) => ({ ...current, ...byId }));
      setSettled((current) => {
        const next = { ...current };
        for (const id of ids) {
          if (byId[id]?.status === "done") next[id] = "sent";
          else if (byId[id]?.status === "dismissed") next[id] = "declined";
        }
        return next;
      });
    } catch (err) {
      console.error("Failed to load proposed action drafts:", err);
    }
  }

  async function loadMessagesFor(threadId: string) {
    setMessages([]);
    setDraftsByAction({});
    setSettled({});
    try {
      const msgs = await employerApi.listChatMessages(threadId);
      setMessages(msgs);
      const ids = msgs.flatMap((m) => m.proposed_action_ids);
      if (ids.length) await hydrateDrafts(ids);
    } catch (err) {
      console.error("Failed to load session messages:", err);
    }
  }

  async function selectThread(threadId: string) {
    if (threadId === activeThreadId) {
      setShowSessions(false);
      return;
    }
    setActiveThreadId(threadId);
    setShowSessions(false);
    setProgressSteps([]);
    await loadMessagesFor(threadId);
  }

  async function startNewThread() {
    try {
      const t = await employerApi.createChatThread();
      setThreads((current) => [t, ...current]);
      setActiveThreadId(t.id);
      setMessages([]);
      setDraftsByAction({});
      setSettled({});
      setProgressSteps([]);
      setShowSessions(false);
    } catch (err) {
      console.error("Failed to start a new Aura chat session:", err);
    }
  }

  async function removeThread(threadId: string, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await employerApi.deleteChatThread(threadId);
    } catch (err) {
      console.error("Failed to delete chat session:", err);
      return;
    }
    const remaining = threads.filter((t) => t.id !== threadId);
    setThreads(remaining);
    if (threadId === activeThreadId) {
      if (remaining.length) await selectThread(remaining[0].id);
      else await startNewThread();
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || !activeThreadId || sending) return;
    const threadId = activeThreadId;
    setInput("");
    setSending(true);
    setProgressSteps([]);
    setMessages((current) => [
      ...current,
      { id: `local-${Date.now()}`, thread_id: threadId, role: "user", content, proposed_action_ids: [], created_at: new Date().toISOString() },
    ]);
    try {
      const reply = await employerApi.streamChatMessage(threadId, content, (evt: ChatProgressEvent) => {
        setProgressSteps((current) => [...current, evt.message]);
      });
      setMessages((current) => [...current, reply]);
      if (reply.proposed_action_ids.length) await hydrateDrafts(reply.proposed_action_ids);
      employerApi.listChatThreads().then(setThreads).catch(() => {});
    } catch (err) {
      console.error("Aura chat send failed:", err);
      setMessages((current) => [
        ...current,
        {
          id: `local-error-${Date.now()}`,
          thread_id: threadId,
          role: "assistant",
          content: "That message didn't reach me — send it again.",
          proposed_action_ids: [],
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setSending(false);
      setProgressSteps([]);
    }
  }

  async function confirmAction(actionId: string) {
    try {
      await employerApi.executeSuggestedAction(actionId);
      setSettled((current) => ({ ...current, [actionId]: "sent" }));
    } catch (err) {
      console.error("Failed to execute proposed action:", err);
    }
  }

  async function declineAction(actionId: string) {
    try {
      await employerApi.updateSuggestedAction(actionId, "dismissed");
      setSettled((current) => ({ ...current, [actionId]: "declined" }));
    } catch (err) {
      console.error("Failed to dismiss proposed action:", err);
    }
  }

  /** A proposal: what Aura would send, and the two answers you can give. */
  function renderProposal(id: string) {
    const draft = draftsByAction[id];
    if (!draft) return null;
    const state = settled[id];
    const subject = (draft.payload.draft_subject as string) ?? draft.title;
    const body = (draft.payload.draft_body as string) ?? draft.body;
    return (
      <div
        key={id}
        className={`aura-chat-proposal${state ? " is-settled" : ""}${
          state === "sent" ? " is-sent" : ""
        }`}
      >
        <span className="aura-chat-proposal-kind">
          {PROPOSAL_KIND[draft.kind] ?? "Proposed message"}
        </span>
        <p className="aura-chat-proposal-subject">{subject}</p>
        {body && <div className="aura-chat-proposal-body">{body}</div>}
        <div className="aura-chat-proposal-foot">
          <span className="aura-chat-proposal-status">
            {state === "sent"
              ? "Sent"
              : state === "declined"
                ? "Not sent"
                : "Awaiting your confirmation"}
          </span>
          {!state && (
            <>
              <button
                type="button"
                className="aura-chat-proposal-decline"
                onClick={() => declineAction(id)}
              >
                Not now
              </button>
              <button
                type="button"
                className="aura-chat-proposal-send"
                onClick={() => confirmAction(id)}
              >
                Send it
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        className={`aura-chat-toggle${open ? " is-open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close Aura" : "Ask Aura"}
        aria-expanded={open}
      >
        <span className="aura-mark" aria-hidden="true" />
        <span className="aura-chat-toggle-close" aria-hidden="true">
          <Icon name="close" size={20} />
        </span>
      </button>

      {open && (
        <div
          className={`aura-chat-panel${wide ? " is-wide" : ""}`}
          role="dialog"
          aria-label="Ask Aura"
        >
          <header className="aura-chat-head">
            <span className="aura-mark" aria-hidden="true" />
            <span className="aura-chat-title">Aura</span>
            <div className="aura-chat-head-actions">
              <button
                type="button"
                className="aura-chat-icon-btn"
                onClick={() => setShowSessions((v) => !v)}
                aria-pressed={showSessions}
                aria-label="Past conversations"
                title="Past conversations"
              >
                <Icon name="history" />
              </button>
              <button
                type="button"
                className="aura-chat-icon-btn"
                onClick={startNewThread}
                aria-label="Start a new conversation"
                title="Start a new conversation"
              >
                <Icon name="plus" />
              </button>
              <button
                type="button"
                className="aura-chat-icon-btn"
                onClick={() => setWide((v) => !v)}
                aria-label={wide ? "Shrink panel" : "Widen panel"}
                title={wide ? "Shrink panel" : "Widen panel"}
              >
                <Icon name={wide ? "collapse" : "expand"} />
              </button>
              <button
                type="button"
                className="aura-chat-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="Close Aura"
                title="Close"
              >
                <Icon name="close" />
              </button>
            </div>
          </header>

          {showSessions && (
            <div className="aura-chat-sessions">
              {threads.length === 0 ? (
                <p className="aura-chat-empty">Nothing here yet.</p>
              ) : (
                threads.map((t) => (
                  <div
                    key={t.id}
                    className={`aura-chat-session${t.id === activeThreadId ? " is-active" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => selectThread(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        selectThread(t.id);
                      }
                    }}
                  >
                    <span className="aura-chat-session-title">
                      {t.title || "New conversation"}
                    </span>
                    <button
                      type="button"
                      className="aura-chat-session-delete"
                      onClick={(e) => removeThread(t.id, e)}
                      aria-label={`Delete ${t.title || "this conversation"}`}
                      title="Delete"
                    >
                      <Icon name="trash" size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="aura-chat-body" ref={scrollRef}>
            {loading ? (
              <div className="aura-chat-progress">
                <span className="aura-mark" aria-hidden="true" />
                <p className="aura-chat-step">opening your workspace</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="aura-chat-turn">
                <span className="aura-mark" aria-hidden="true" />
                <div className="aura-chat-said">
                  <div className="aura-chat-empty">
                    <strong>Ask me about your hiring.</strong>
                    I can read your pipeline, weigh up candidates, and draft the emails —
                    you approve anything before it goes out.
                  </div>
                  <div className="aura-chat-quick">
                    {QUICK_ACTIONS.map((q) => (
                      <button key={q} className="aura-chat-chip" onClick={() => send(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="aura-chat-msg-user">
                    <div className="aura-chat-bubble">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="aura-chat-turn">
                    <span className="aura-mark" aria-hidden="true" />
                    <div className="aura-chat-said">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      {m.proposed_action_ids.map(renderProposal)}
                    </div>
                  </div>
                ),
              )
            )}
            {sending && (
              <div className="aura-chat-progress">
                <span className="aura-mark" aria-hidden="true" />
                <p key={progressSteps.length} className="aura-chat-step">
                  {progressSteps.length ? progressSteps[progressSteps.length - 1] : "thinking"}
                </p>
              </div>
            )}
          </div>

          <form
            className="aura-chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about your pipeline…"
              disabled={sending || !activeThreadId}
            />
            <button
              className="aura-chat-send"
              type="submit"
              disabled={sending || !input.trim()}
              aria-label="Send message"
            >
              <Icon name="send" size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
