"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  jobs,
  headhunterInitials,
  headhunterStatusChipClass,
  type HeadhunterStatus,
} from "@/app/employer/data";
import SectionHeader from "@/components/employer/job-editor/SectionHeader";
import jobEditorStyles from "@/components/employer/job-editor/JobEditor.module.css";
import styles from "./HeadhunterEditor.module.css";

export type HeadhunterSeed = {
  id?: string;
  name?: string;
  persona?: string;
  status?: HeadhunterStatus;
  focusAreas?: string[];
};

const statusOptions: HeadhunterStatus[] = ["Draft", "Active", "Paused"];

const statusHints: Record<HeadhunterStatus, string> = {
  Active: "This headhunter is actively sourcing candidates for its assigned jobs.",
  Paused: "Sourcing is paused. Existing suggestions stay visible; no new ones will be added.",
  Draft: "Draft agents are saved but won't source candidates until deployed.",
};

export default function HeadhunterEditor({
  mode,
  initialHeadhunter = {},
}: {
  mode: "create" | "edit";
  initialHeadhunter?: HeadhunterSeed;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialHeadhunter.name ?? "");
  const avatarMark = headhunterInitials(name);
  const [persona, setPersona] = useState(initialHeadhunter.persona ?? "");
  const [focusAreas, setFocusAreas] = useState<string[]>(
    initialHeadhunter.focusAreas ?? [],
  );
  const [focusDraft, setFocusDraft] = useState("");
  const [assignedJobIds, setAssignedJobIds] = useState<string[]>(() =>
    jobs
      .filter((job) => job.headhunterIds.includes(initialHeadhunter.id ?? ""))
      .map((job) => job.id),
  );
  const [status, setStatus] = useState<HeadhunterStatus>(
    initialHeadhunter.status ?? "Draft",
  );
  const [saved, setSaved] = useState(false);

  function addFocusArea() {
    const value = focusDraft.trim();
    if (
      !value ||
      focusAreas.some((area) => area.toLowerCase() === value.toLowerCase())
    ) {
      return;
    }
    setFocusAreas((current) => [...current, value]);
    setFocusDraft("");
  }

  function toggleJob(jobId: string, enabled: boolean) {
    setAssignedJobIds((current) =>
      enabled ? [...current, jobId] : current.filter((id) => id !== jobId),
    );
  }

  function save() {
    setSaved(true);
    window.setTimeout(() => router.push("/employer/headhunters"), 650);
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {mode === "create" ? "New agent" : "Configuration"}
          </p>
          <h1>
            {mode === "create"
              ? "Create a headhunter"
              : `Edit ${initialHeadhunter.name}`}
          </h1>
          <p>
            Configure how this AI agent sources and evaluates candidates,
            then deploy it to a job.
          </p>
        </div>
        <div className={jobEditorStyles.headerActions}>
          <button
            className="btn btn-ghost"
            onClick={() => router.push("/employer/headhunters")}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!name.trim()}
            onClick={save}
          >
            {saved
              ? "Saved ✓"
              : mode === "create"
                ? "Create headhunter"
                : "Save changes"}
          </button>
        </div>
      </div>

      <div className={jobEditorStyles.layout}>
        <main>
          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="01"
              title="Identity"
              description="Name and describe this agent's specialization."
            />
            <div className={styles.identityRow}>
              <span className="candidate-avatar candidate-avatar-large">
                {avatarMark}
              </span>
              <label className={`${styles.field} ${styles.identityFields}`}>
                <span>Name</span>
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Aura Technical Sourcer"
                />
              </label>
            </div>
            <label className={styles.field}>
              <span>Persona</span>
              <textarea
                className="input"
                value={persona}
                onChange={(event) => setPersona(event.target.value)}
                placeholder="What does this headhunter specialize in?"
              />
            </label>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="02"
              title="Focus areas"
              description="Sourcing keywords and skills this agent should prioritize."
            />
            <div className={jobEditorStyles.keywordEditor}>
              <div className={jobEditorStyles.keywordInput}>
                <input
                  value={focusDraft}
                  onChange={(event) => setFocusDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFocusArea();
                    }
                  }}
                  placeholder="Add a focus area"
                />
                <button onClick={addFocusArea}>Add</button>
              </div>
              <div className={jobEditorStyles.keywords}>
                {focusAreas.map((area) => (
                  <span key={area}>
                    {area}
                    <button
                      onClick={() =>
                        setFocusAreas((current) =>
                          current.filter((item) => item !== area),
                        )
                      }
                      aria-label={`Remove ${area}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="03"
              title="Assigned jobs"
              description="Which open roles should this headhunter actively source for. Any number can be selected."
            />
            {jobs.length === 0 ? (
              <p style={{ color: "var(--ink-55)", fontSize: "0.82rem" }}>
                No jobs available yet.
              </p>
            ) : (
              <div className={jobEditorStyles.headhunterList}>
                {jobs.map((job) => {
                  const checked = assignedJobIds.includes(job.id);
                  return (
                    <label key={job.id} className={jobEditorStyles.headhunterRow}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          toggleJob(job.id, event.target.checked)
                        }
                      />
                      <span className={jobEditorStyles.check}>✓</span>
                      <div>
                        <div className={jobEditorStyles.headhunterRowHead}>
                          <strong>{job.title}</strong>
                          <span
                            className={`chip ${job.status === "Active" ? "chip-tier-high" : ""}`}
                          >
                            {job.status}
                          </span>
                        </div>
                        <small>
                          {job.team} · {job.location}
                        </small>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <SectionHeader
              number="04"
              title="Status"
              description="Deploy this headhunter to start sourcing, or pause it at any time."
            />
            <div className={styles.statusOptions}>
              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`chip ${styles.statusOption} ${status === option ? headhunterStatusChipClass(option) : ""}`}
                  onClick={() => setStatus(option)}
                >
                  {option}
                </button>
              ))}
            </div>
            <p className={styles.statusHint}>{statusHints[status]}</p>
          </section>
        </main>

        <aside>
          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <p className="eyebrow">Live preview</p>
            <div className={styles.previewHead}>
              <span className="candidate-avatar candidate-avatar-large">
                {avatarMark}
              </span>
              <div>
                <strong>{name || "Untitled headhunter"}</strong>
                <span className={`chip ${headhunterStatusChipClass(status)}`}>
                  {status}
                </span>
              </div>
            </div>
            <p className={styles.previewPersona}>
              {persona || "Describe this agent's specialization to see it here."}
            </p>
            <div className="talent-pool-tags">
              {focusAreas.length > 0 ? (
                focusAreas.map((area) => <span key={area}>{area}</span>)
              ) : (
                <span>No focus areas yet</span>
              )}
            </div>
            <div className={styles.previewStat}>
              <strong>{assignedJobIds.length}</strong>
              <span>job{assignedJobIds.length === 1 ? "" : "s"} assigned</span>
            </div>
          </section>

          <section className={`panel employer-section ${jobEditorStyles.section}`}>
            <p className="eyebrow">How it appears in Talent Pool</p>
            <span className="headhunter-badge">
              ✦ Sourced by {name || "this headhunter"}
            </span>
            <p className={styles.previewNote}>
              Every candidate this agent surfaces gets this badge, plus a
              spotlight slot at the top of Talent Pool.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
