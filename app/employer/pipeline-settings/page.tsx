"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { defaultPipelinePhases } from "@/app/employer/data";
import { employerApi, type PhaseDef } from "@/lib/employerApi";
import PipelineListEditor from "@/components/employer/PipelineListEditor";

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

function newPhaseId() {
  return `phase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function PipelineSettingsPage() {
  const router = useRouter();
  const [phases, setPhases] = useState<PhaseDef[]>(defaultPipelinePhases.map((p) => ({ ...p })));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getProfile()
      .then((profile) => {
        if (!cancelled && profile.hiring_pipeline_phases?.length)
          setPhases(profile.hiring_pipeline_phases.map((p) => ({ ...p })));
      })
      .catch(() => {
        /* no profile yet — defaults stand, first save creates the row */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    try {
      await employerApi.upsertProfile({ hiring_pipeline_phases: phases });
      setSaved(true);
      window.setTimeout(() => router.push("/employer"), 650);
    } catch (err) {
      console.error("Failed to save phases:", err);
      setSaving(false);
    }
  }

  return (
    <div className="employer-page">

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Pipeline configuration</p>
          <h1>Hiring pipeline phases</h1>
          <p>
            These are the columns every job listing moves through on the
            Overview hiring pipeline board, from headcount planning to
            close. Reorder, rename, recolor, add, or remove phases — this
            applies across your whole workspace.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={phases.length === 0 || saving}
        >
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save phases"}
        </button>
      </div>

      <section className="panel employer-section">
        <PipelineListEditor
          items={phases}
          onChange={setPhases}
          addLabel="Add phase"
          createItem={() => ({
            id: newPhaseId(),
            label: "New phase",
            color: SWATCHES[phases.length % SWATCHES.length],
          })}
        />
      </section>
    </div>
  );
}
