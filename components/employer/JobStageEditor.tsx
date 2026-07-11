"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { defaultApplicationStages } from "@/app/employer/data";
import { employerApi, type EmployerJob, type StageDef } from "@/lib/employerApi";
import PipelineListEditor, { type EditableItem } from "@/components/employer/PipelineListEditor";

const SWATCHES = [
  "#475569",
  "#2563eb",
  "#4f46e5",
  "#7c3aed",
  "#d97706",
  "#0d9488",
  "#16a34a",
  "#0891b2",
];

export default function JobStageEditor({ job }: { job: EmployerJob }) {
  const router = useRouter();
  const configured = job.job_application_stages?.length
    ? job.job_application_stages
    : defaultApplicationStages;
  const [steps, setSteps] = useState<StageDef[]>(() =>
    configured.filter((step) => !step.is_rejected).map((step) => ({ ...step })),
  );
  const [rejected, setRejected] = useState<EditableItem>(() => {
    const terminal = configured.find((step) => step.is_rejected);
    return terminal
      ? { label: terminal.label, color: terminal.color }
      : { label: "Rejected", color: "#dc2626" };
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    const stages: StageDef[] = [
      ...steps.map((step) => ({ ...step, is_rejected: false })),
      { label: rejected.label, color: rejected.color, is_rejected: true },
    ];
    try {
      await employerApi.updateJob(job.id, { job_application_stages: stages });
      setSaved(true);
      window.setTimeout(() => router.push(`/employer/jobs/${job.id}`), 650);
    } catch (err) {
      console.error("Failed to save stages:", err);
      setSaving(false);
    }
  }

  return (
    <div className="employer-page">
      <Link href={`/employer/jobs/${job.id}`} className="back-link">
        ← {job.title}
      </Link>

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Pipeline configuration</p>
          <h1>Application stages</h1>
          <p>
            The stages a candidate moves through while applying to{" "}
            <strong>{job.title}</strong>. Reorder, rename, recolor, add, or
            remove stages — this only affects this job.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={steps.length === 0 || saving}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save stages"}
        </button>
      </div>

      <section className="panel employer-section">
        <PipelineListEditor
          items={steps}
          onChange={setSteps}
          addLabel="Add stage"
          pinned={rejected}
          onPinnedChange={setRejected}
          createItem={() => ({
            label: "New stage",
            color: SWATCHES[steps.length % SWATCHES.length],
            is_rejected: false,
          })}
        />
      </section>
    </div>
  );
}
