"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { employerApi } from "@/lib/employerApi";

// Mirrors the template shape served by /templates (see templates hub).
type Template = {
  id: string;
  category: string;
  purpose: string;
  recommended_case?: string;
  tone_options?: string[];
  placeholders: string[];
  subject_template: string;
  body_template: string;
  role: string;
};

type CandidateEmailComposerProps = {
  candidateName: string;
  role: string;
  score?: number;
  candidateUserId?: string;
  jobId?: string;
  /** Button label; defaults to "Email candidate". */
  buttonLabel?: string;
  /** Button class; defaults to the primary button. */
  buttonClassName?: string;
  /** Bias the template list toward a category (e.g. "Offer"). */
  categoryFilter?: string;
  /** Pre-fills the "what should this email accomplish" box, so a caller that
   * already knows the purpose (e.g. the Shortlists page's stage-specific
   * invite) opens the composer with intent set. Still editable, and nothing
   * is drafted until "Generate with Aura" is pressed. */
  defaultPrompt?: string;
  /** Called after a successful send (e.g. so a parent list can mark this
   * candidate's offer as sent without waiting for a reload). */
  onSent?: () => void;
};

// Tolerant placeholder substitution: handles {{key}}, {key}, [key], [[key]].
// Also falls back to the full raw match string as a key (e.g. "[Candidate Name]")
// so LLM-populated dicts whose keys include the brackets are found correctly.
function applyPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(
    /\{\{?\s*([\w. ]+)\s*\}?\}|\[\[?\s*([\w. ]+)\s*\]?\]/g,
    (match, a, b) => {
      const key = String(a ?? b ?? "").trim();
      return (
        values[key] ??
        values[key.toLowerCase()] ??
        // Try the full bracket form that the LLM may have used as the key
        values[match] ??
        values[match.toLowerCase()] ??
        match
      );
    },
  );
}

export default function CandidateEmailComposer({
  candidateName,
  role,
  score,
  candidateUserId,
  jobId,
  buttonLabel = "Email candidate",
  buttonClassName = "btn btn-primary",
  categoryFilter,
  defaultPrompt,
  onSent,
}: CandidateEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [prompt, setPrompt] = useState(defaultPrompt ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const [sendError, setSendError] = useState<string | null>(null);
  const isOffer = (categoryFilter ?? "").toLowerCase() === "offer";

  // Load the shared template library the first time the composer opens.
  // Skipped for the offer flow — Aura always drafts offers from real
  // candidate context, never a template, so there's nothing to preload.
  useEffect(() => {
    if (!open || templates.length || isOffer) return;
    let cancelled = false;
    api
      .listTemplates("employer")
      .then((items) => {
        if (cancelled) return;
        const list = (items as Template[]) ?? [];
        setTemplates(
          categoryFilter
            ? [...list].sort((a, b) =>
                Number(b.category?.toLowerCase().includes(categoryFilter.toLowerCase())) -
                Number(a.category?.toLowerCase().includes(categoryFilter.toLowerCase())),
              )
            : list,
        );
      })
      .catch((err) => console.error("Failed to load templates:", err));
    return () => {
      cancelled = true;
    };
  }, [open, templates.length, categoryFilter, isOffer]);

  const selectedTemplate = templates.find((template) => template.id === templateId);

  // Local fallback used when no template is chosen or the backend is offline.
  function localDraft(): { subject: string; body: string } {
    const firstName = candidateName.split(" ")[0];
    const standout = score != null ? ` Your evaluation stood out (${score}/100).` : "";
    return {
      subject: `Regarding your application for ${role}`,
      body: `Hi ${firstName},\n\nThank you for the time and thought you brought to our ${role} process.${standout}\n\n${prompt.trim() || "We'd like to continue the conversation about next steps."}\n\nBest,\nThe hiring team`,
    };
  }

  async function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) {
      // Cleared — reset fields
      setSubject("");
      setBody("");
      return;
    }
    // Show raw template immediately so user sees content right away.
    setSubject(template.subject_template);
    setBody(template.body_template);
    // Then asynchronously populate placeholders with real candidate/job data.
    if (!template.placeholders?.length) return;
    setBusy(true);
    try {
      const res = await api.populatePlaceholders({
        placeholders: template.placeholders,
        role: "employer",
        candidate_user_id: candidateUserId,
        job_id: jobId,
      });
      const values = res.populated ?? {};
      setSubject(applyPlaceholders(template.subject_template, values));
      setBody(applyPlaceholders(template.body_template, values));
    } catch (err) {
      console.error("Failed to populate placeholders:", err);
      // Leave the raw template shown — user can edit manually.
    } finally {
      setBusy(false);
    }
  }

  /** The composer has exactly two ways to fill the email: write it yourself,
   * or press this. Drafting runs through the shared template writer, with the
   * caller's purpose, the selected template's structure, and who it's for all
   * folded into one prompt. */
  async function generate() {
    setBusy(true);
    try {
      const parts = [
        prompt.trim() || `Write a ${role} email to ${candidateName}.`,
        `The recipient is ${candidateName}, a candidate for ${role}.`,
      ];
      if (selectedTemplate) {
        parts.push(
          `Follow this template structure (adapt the content, do not copy verbatim):\n` +
            `Subject format: ${selectedTemplate.subject_template}\n` +
            `Body format:\n${selectedTemplate.body_template}`,
        );
      }
      const res = await api.generateTemplate({
        prompt: parts.join("\n\n"),
        template_id: templateId || undefined,
        role: "employer",
      });
      setSubject(res.subject);
      setBody(res.body);
    } catch (err) {
      console.error("Aura draft failed, using local fallback:", err);
      const draft = localDraft();
      setSubject(draft.subject);
      setBody(draft.body);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setOpen(false);
  }

  async function sendEmail() {
    setSendError(null);
    if (!candidateUserId) {
      // No candidate id to address — nothing to send to.
      setSendError("No candidate on file to send to.");
      return;
    }
    setBusy(true);
    try {
      await employerApi.sendComms({
        candidate_user_id: candidateUserId,
        subject,
        body,
        job_id: jobId,
        template_id: templateId || undefined,
        is_offer: isOffer,
      });
      setSent(true);
      onSent?.();
      window.setTimeout(() => {
        close();
        setSent(false);
      }, 900);
    } catch (err) {
      console.error("Failed to send email:", err);
      setSendError(err instanceof Error ? err.message : "Failed to send email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className={buttonClassName} onClick={() => setOpen(true)}>
        {buttonLabel}
      </button>
      {open && (
        // Use onMouseDown instead of onClick so the backdrop close does not
        // swallow mousedown events that are meant for inputs inside the modal
        // (which would prevent text editing, including deleting characters).
        <div className="candidate-email-backdrop" onMouseDown={close}>
          <section
            className="candidate-email-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-email-title"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Candidate communication</p>
                <h2 id="candidate-email-title">Email {candidateName}</h2>
              </div>
              <button
                className="candidate-email-close"
                onClick={close}
                aria-label="Close email composer"
              >
                ×
              </button>
            </header>

            {/* Drafting overwrites subject and body, so everything that feeds
                or holds the draft locks until it lands. Cancel and close stay
                live — nobody should be stuck waiting on a draft. */}
            <fieldset className="candidate-email-fields" disabled={busy}>
              {!isOffer && (
                <>
                  <label>
                    <span>Start from a template</span>
                    <select
                      className="input"
                      value={templateId}
                      onChange={(event) => applyTemplate(event.target.value)}
                    >
                      <option value="">No template — write from scratch</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.category ? `${template.category} · ` : ""}
                          {template.purpose}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedTemplate?.recommended_case && (
                    <p className="candidate-email-hint">
                      {selectedTemplate.recommended_case}
                    </p>
                  )}
                </>
              )}
              <label>
                <span>Tell Aura what this email should accomplish</span>
                <textarea
                  className="input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Example: Extend an offer, summarize the package, and ask for a decision by Friday."
                />
              </label>
              <button
                className="btn btn-ghost aura-generate-email"
                onClick={generate}
                disabled={busy}
                aria-busy={busy}
              >
                {busy ? "Drafting…" : "✦ Generate with Aura"}
              </button>
              <label>
                <span>Subject</span>
                <input
                  className="input"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="Email subject"
                />
              </label>
              <label>
                <span>Email</span>
                <textarea
                  className="input candidate-email-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder={
                    busy
                      ? "Aura is drafting…"
                      : "Pick a template, generate a draft, or write your own."
                  }
                />
              </label>
            </fieldset>

            <footer>
              <small>
                {sendError ? (
                  <span style={{ color: "#dc2626" }}>{sendError}</span>
                ) : (
                  "Sends via Aura and is logged on the candidate's timeline. Delivery requires a mail provider configured on the backend."
                )}
              </small>
              <div>
                <button className="btn btn-ghost" onClick={close}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!subject.trim() || !body.trim() || busy}
                  onClick={sendEmail}
                >
                  {sent ? "Sent ✓" : isOffer ? "Send offer" : "Send email"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
