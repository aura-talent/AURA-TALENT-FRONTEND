"use client";

import { useState } from "react";

type CandidateEmailComposerProps = {
  candidateName: string;
  role: string;
  score: number;
};

export default function CandidateEmailComposer({
  candidateName,
  role,
  score,
}: CandidateEmailComposerProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);

  function generateWithAura() {
    const firstName = candidateName.split(" ")[0];
    setSubject(`Staying connected with Northstar Labs`);
    setBody(
      `Hi ${firstName},\n\nThank you again for the time and thought you brought to our ${role} process. Your evaluation stood out, particularly the strength and consistency of your evidence (${score}/100).\n\nAlthough we are not moving forward with this role, we would value staying connected and considering you for future opportunities that better match your experience and direction. With your permission, we would like to keep your profile in our talent pool and reach out when a suitable role opens.\n\nBest,\nNorthstar Labs Talent Team`,
    );
  }

  function sendEmail() {
    setSent(true);
    window.setTimeout(() => {
      setOpen(false);
      setSent(false);
    }, 900);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Email candidate
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
              <label>
                <span>Tell Aura what this email should accomplish</span>
                <textarea
                  className="input"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Example: Thank Daniel for interviewing, explain that we chose another finalist, and invite him to join our talent pool."
                />
              </label>
              <button className="btn btn-ghost aura-generate-email" onClick={generateWithAura}>
                ✦ Generate with Aura
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
                  placeholder="Write an email or generate a draft with Aura."
                />
              </label>
            </div>

            <footer>
              <small>Prototype mode: sending is simulated and no email leaves Aura.</small>
              <div>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!subject.trim() || !body.trim()}
                  onClick={sendEmail}
                >
                  {sent ? "Sent ✓" : "Send email"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
