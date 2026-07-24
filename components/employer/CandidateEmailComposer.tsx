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
  score: number;
  candidateUserId?: string;
  jobId?: string;
  /** Button label; defaults to "Email candidate". */
  buttonLabel?: string;
  /** Button class; defaults to the primary button. */
  buttonClassName?: string;
  /** Bias the template list toward a category (e.g. "Offer"). */
  categoryFilter?: string;
  /** Called after a successful send (e.g. so a parent list can mark this
   * candidate's offer as sent without waiting for a reload). */
  onSent?: () => void;
};

// Maps a selected template to the communication writer's `kind` — the offer
// flow always overrides this via isOffer, since "Offer" isn't a template category.
const KIND_BY_TEMPLATE: Record<string, string> = {
  interview_invitation: "interview_invite",
  interview_scheduling: "interview_invite",
  candidate_rejection: "rejection",
};

// Tolerant placeholder substitution: handles {{key}}, {key}, [key], [[key]].
function applyPlaceholders(text: string, values: Record<string, string>): string {
  return text.replace(
    /\{\{?\s*([\w.]+)\s*\}?\}|\[\[?\s*([\w.]+)\s*\]?\]/g,
    (match, a, b) => {
      const key = String(a ?? b ?? "").trim();
      return values[key] ?? values[key.toLowerCase()] ?? match;
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
  onSent,
}: CandidateEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [prompt, setPrompt] = useState("");
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
    return {
      subject: `Regarding your application for ${role}`,
      body: `Hi ${firstName},\n\nThank you for the time and thought you brought to our ${role} process. Your evaluation stood out (${score}/100).\n\n${prompt.trim() || "We'd like to continue the conversation about next steps."}\n\nBest,\nThe hiring team`,
    };
  }

  async function applyTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((item) => item.id === id);
    if (!template) return;
    // Immediate feedback with the raw template, then fill placeholders.
    let values: Record<string, string> = {};
    try {
      if (template.placeholders?.length) {
        const res = await api.populatePlaceholders({
          placeholders: template.placeholders,
          role: "employer",
          candidate_user_id: candidateUserId,
          job_id: jobId,
        });
        values = res.populated ?? {};
      }
    } catch (err) {
      console.error("Failed to populate placeholders:", err);
    }
    setSubject(applyPlaceholders(template.subject_template, values));
    setBody(applyPlaceholders(template.body_template, values));
  }

  async function generate() {
    setBusy(true);
    try {
      if (candidateUserId) {
        // Context-aware draft: the communication writer sees the candidate's
        // real evaluation, stage, offer status, and the employer's own voice —
        // not just a raw prompt, so it doesn't fall back to generic placeholders.
        const kind = isOffer
          ? "offer"
          : (selectedTemplate && KIND_BY_TEMPLATE[selectedTemplate.id]) || "general";
        const draft = await employerApi.generateComms({
          candidate_user_id: candidateUserId,
          job_id: jobId,
          kind,
          instructions: prompt.trim() || undefined,
        });
        setSubject(draft.subject);
        setBody(draft.body);
      } else {
        // No candidate to ground the draft in — fall back to the generic writer.
        const res = await api.generateTemplate({
          prompt: prompt.trim() || `Write a ${role} email to ${candidateName}.`,
          template_id: templateId || undefined,
          role: "employer",
        });
        setSubject(res.subject);
        setBody(res.body);
      }
    } catch (err) {
      console.error("Aura draft failed, using local fallback:", err);
      const draft = localDraft();
      setSubject(draft.subject);
      setBody(draft.body);
    } finally {
      setBusy(false);
    }
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
        setOpen(false);
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
        <div className="candidate-email-backdrop" onClick={() => setOpen(false)}>
          <section
            className="candidate-email-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-email-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Candidate communication</p>
                <h2 id="candidate-email-title">Email {candidateName}</h2>
              </div>
              <button
                className="candidate-email-close"
                onClick={() => setOpen(false)}
                aria-label="Close email composer"
              >
                ×
              </button>
            </header>

            <div className="candidate-email-fields">
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
                  placeholder="Pick a template, generate a draft, or write your own."
                />
              </label>
            </div>

            <footer>
              <small>
                {sendError ? (
                  <span style={{ color: "#dc2626" }}>{sendError}</span>
                ) : (
                  "Sends via Aura and is logged on the candidate's timeline. Delivery requires a mail provider configured on the backend."
                )}
              </small>
              <div>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
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
