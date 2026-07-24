"use client";

import { useState } from "react";

export default function BountyContactButton({
  candidateName,
  contactEmail,
  bountyTitle,
  prizeAmount,
  currency,
}: {
  candidateName: string;
  contactEmail: string;
  bountyTitle: string;
  prizeAmount: number;
  currency: string;
}) {
  const firstName = candidateName.split(" ")[0];
  const defaultSubject = `You won ${bountyTitle} 🎉`;
  const defaultBody = `Hi ${firstName},\n\nCongratulations — your submission to "${bountyTitle}" was selected as a winner. A prize of ${currency} ${prizeAmount.toLocaleString()} has been recorded for you.\n\nBeyond the prize, we were genuinely impressed by the quality of your work and would love to talk about opportunities to work together more directly. Are you open to a quick call?\n\nBest,\nThe hiring team`;

  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState(defaultBody);

  function openMailClient() {
    const params = new URLSearchParams({ subject, body });
    window.location.href = `mailto:${contactEmail}?${params.toString().replace(/\+/g, "%20")}`;
    setOpen(false);
  }

  return (
    <>
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        Contact candidate
      </button>
      {open && (
        <div className="candidate-email-backdrop" onClick={() => setOpen(false)}>
          <section
            className="candidate-email-modal panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bounty-contact-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <p className="eyebrow">Bounty winner outreach</p>
                <h2 id="bounty-contact-title">Contact {candidateName}</h2>
              </div>
              <button
                className="candidate-email-close"
                onClick={() => setOpen(false)}
                aria-label="Close contact composer"
              >
                ×
              </button>
            </header>

            <div className="candidate-email-fields">
              <label>
                <span>To</span>
                <input className="input" value={contactEmail} readOnly />
              </label>
              <label>
                <span>Subject</span>
                <input
                  className="input"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                />
              </label>
              <label>
                <span>Email</span>
                <textarea
                  className="input candidate-email-body"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                />
              </label>
            </div>

            <footer>
              <small>Opens your email client with this drafted message.</small>
              <div>
                <button className="btn btn-ghost" onClick={() => setOpen(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={openMailClient}>
                  Open in email client
                </button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
