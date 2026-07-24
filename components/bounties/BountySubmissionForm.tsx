"use client";

import { useState } from "react";
import {
  bountyApi,
  isSubmissionComplete,
  type Bounty,
  type BountySubmission,
  type RequirementResponse,
  type TeamMember,
} from "@/lib/bountyApi";

export default function BountySubmissionForm({
  bounty,
  candidateUserId,
  candidateEmail,
  existing,
  onSaved,
}: {
  bounty: Bounty;
  candidateUserId: string;
  candidateEmail: string;
  existing: BountySubmission | null;
  onSaved: (submission: BountySubmission) => void;
}) {
  const [contactName, setContactName] = useState(existing?.contact_name ?? "");
  const [contactEmail, setContactEmail] = useState(existing?.contact_email ?? candidateEmail);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(existing?.team_members ?? []);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [responses, setResponses] = useState<Record<string, RequirementResponse>>(
    existing?.responses ?? {},
  );
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deadlinePassed = Boolean(
    bounty.deadline && new Date(bounty.deadline).getTime() < Date.now(),
  );
  const showTeamMembers = bounty.submission_mode !== "individual";
  const teamRequired = bounty.submission_mode === "team";

  async function handleFile(itemId: string, file: File) {
    setUploadingId(itemId);
    try {
      const path = await bountyApi.uploadSubmissionFile(bounty.id, candidateUserId, itemId, file);
      setResponses((current) => ({ ...current, [itemId]: { type: "file", value: path } }));
    } catch (err) {
      console.error("Failed to upload file:", err);
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploadingId(null);
    }
  }

  function addTeamMember() {
    setTeamMembers((current) => [...current, { name: "", email: "" }]);
  }

  const complete = isSubmissionComplete(bounty.requirement_items, responses);
  const canSave =
    complete &&
    contactName.trim().length > 0 &&
    contactEmail.trim().length > 0 &&
    (!teamRequired || teamMembers.length > 0) &&
    !deadlinePassed;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const submission = await bountyApi.upsertSubmission(bounty.id, candidateUserId, {
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        team_members: showTeamMembers ? teamMembers.filter((m) => m.name.trim()) : [],
        responses,
        notes,
      });
      onSaved(submission);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save submission:", err);
      setError(err instanceof Error ? err.message : "Failed to save submission");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel employer-section">
      <h2>{existing ? "Your submission" : "Submit an entry"}</h2>
      {deadlinePassed && (
        <p className="notice notice-warn">The deadline has passed — submissions are closed.</p>
      )}
      {error && <p className="notice notice-error">{error}</p>}

      <div className="form-grid">
        <div className="field">
          <label>Your name</label>
          <input
            className="input"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="field">
          <label>Contact email</label>
          <input
            className="input"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
      </div>

      {showTeamMembers && (
        <div className="field">
          <label>Team members {teamRequired ? "(required)" : "(optional)"}</label>
          {teamMembers.map((member, index) => (
            <div key={index} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <input
                className="input"
                placeholder="Name"
                value={member.name}
                onChange={(event) =>
                  setTeamMembers((current) =>
                    current.map((m, i) => (i === index ? { ...m, name: event.target.value } : m)),
                  )
                }
              />
              <input
                className="input"
                placeholder="Email"
                value={member.email}
                onChange={(event) =>
                  setTeamMembers((current) =>
                    current.map((m, i) => (i === index ? { ...m, email: event.target.value } : m)),
                  )
                }
              />
              <button
                className="btn btn-ghost"
                onClick={() => setTeamMembers((current) => current.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button className="btn btn-ghost" onClick={addTeamMember}>
            + Add teammate
          </button>
        </div>
      )}

      {bounty.requirement_items.map((item) => {
        const response = responses[item.id];
        return (
          <div className="field" key={item.id}>
            <label>
              {item.label} {item.required ? "(required)" : "(optional)"}
            </label>
            {item.description && <small>{item.description}</small>}
            {item.type === "file" ? (
              <div className="dropzone">
                <input
                  type="file"
                  onChange={(event) =>
                    event.target.files?.[0] && handleFile(item.id, event.target.files[0])
                  }
                />
                {uploadingId === item.id
                  ? "Uploading…"
                  : response?.type === "file"
                    ? "File uploaded ✓"
                    : "Choose a file"}
              </div>
            ) : item.type === "link" ? (
              <input
                className="input"
                placeholder="https://…"
                value={response?.value ?? ""}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [item.id]: { type: "link", value: event.target.value },
                  }))
                }
              />
            ) : (
              <textarea
                className="input"
                value={response?.value ?? ""}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [item.id]: { type: "text", value: event.target.value },
                  }))
                }
              />
            )}
          </div>
        );
      })}

      <div className="field">
        <label>Notes (optional)</label>
        <textarea className="input" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      <button className="btn btn-primary" disabled={!canSave || saving} onClick={save}>
        {saved ? "Saved ✓" : saving ? "Saving…" : existing ? "Update submission" : "Submit entry"}
      </button>
    </section>
  );
}
