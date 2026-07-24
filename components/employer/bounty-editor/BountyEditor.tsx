"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import {
  bountyApi,
  totalPrizePool,
  type Bounty,
  type BountyEditorMode,
  type RequirementItem,
  type SubmissionMode,
  type WinnerSlot,
} from "@/lib/bountyApi";
import DetailsSection from "./DetailsSection";
import RequirementsSection from "./RequirementsSection";
import PrizesSection from "./PrizesSection";
import SettingsSection from "./SettingsSection";
import type { BountyDetails } from "./types";
import styles from "./BountyEditor.module.css";

const emptyDetails: BountyDetails = {
  title: "",
  tags: [],
  rulesText: "",
};

function detailsFromBounty(bounty: Bounty): BountyDetails {
  return { title: bounty.title, tags: bounty.tags, rulesText: bounty.rules_text ?? "" };
}

export default function BountyEditor({
  mode,
  initialBounty,
}: {
  mode: BountyEditorMode;
  initialBounty?: Bounty;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [details, setDetails] = useState<BountyDetails>(
    initialBounty ? detailsFromBounty(initialBounty) : emptyDetails,
  );
  const [tagDraft, setTagDraft] = useState("");
  const [requirements, setRequirements] = useState<RequirementItem[]>(
    initialBounty?.requirement_items ?? [],
  );
  const [winnerSlots, setWinnerSlots] = useState<WinnerSlot[]>(
    initialBounty?.winner_slots ?? [{ rank: 1, prize_amount: 0 }],
  );
  const [currency, setCurrency] = useState(initialBounty?.currency ?? "USD");
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(
    initialBounty?.submission_mode ?? "individual",
  );
  const [deadline, setDeadline] = useState(
    initialBounty?.deadline ? initialBounty.deadline.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = mode === "create" || initialBounty?.status === "draft";

  function addTag() {
    const value = tagDraft.trim();
    if (!value || details.tags.some((t) => t.toLowerCase() === value.toLowerCase())) return;
    setDetails((current) => ({ ...current, tags: [...current.tags, value] }));
    setTagDraft("");
  }

  function addRequirement() {
    setRequirements((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        label: "New requirement",
        description: "",
        type: "text",
        required: true,
      },
    ]);
  }

  function addWinnerSlot() {
    setWinnerSlots((current) => [...current, { rank: current.length + 1, prize_amount: 0 }]);
  }

  function removeWinnerSlot(rank: number) {
    setWinnerSlots((current) =>
      current
        .filter((slot) => slot.rank !== rank)
        .map((slot, index) => ({ ...slot, rank: index + 1 })),
    );
  }

  async function save(publish: boolean) {
    if (!user) return;
    setSaving(true);
    setError(null);
    const payload = {
      title: details.title.trim() || "Untitled bounty",
      tags: details.tags,
      rules_text: details.rulesText,
      requirement_items: requirements,
      submission_mode: submissionMode,
      winner_slots: winnerSlots,
      currency,
      deadline: deadline ? new Date(deadline).toISOString() : null,
    };
    try {
      let bounty: Bounty;
      if (mode === "create") {
        bounty = await bountyApi.create(user.id, payload);
      } else {
        bounty = await bountyApi.update(initialBounty!.id, payload);
      }
      if (publish) {
        await bountyApi.publish(bounty.id);
      }
      setSaved(true);
      window.setTimeout(() => router.push(`/employer/bounties/${bounty.id}`), 650);
    } catch (err) {
      console.error("Failed to save bounty:", err);
      setError(err instanceof Error ? err.message : "Failed to save bounty");
      setSaving(false);
    }
  }

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">{mode === "create" ? "New bounty" : "Edit bounty"}</p>
          <h1>{mode === "create" ? "Create a bounty" : `Edit ${initialBounty?.title}`}</h1>
          <p>
            {isDraft
              ? "Define the brief, requirements, and prize pool, then publish to the marketplace."
              : "This bounty is live. Changes apply immediately and are visible to candidates."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            className="btn btn-ghost"
            onClick={() =>
              router.push(
                mode === "edit" ? `/employer/bounties/${initialBounty!.id}` : "/employer/bounties",
              )
            }
          >
            Cancel
          </button>
          {isDraft ? (
            <>
              <button className="btn btn-ghost" disabled={saving} onClick={() => save(false)}>
                Save draft
              </button>
              <button
                className="btn btn-primary"
                disabled={saving || !details.title.trim() || winnerSlots.length === 0}
                onClick={() => save(true)}
              >
                {saved ? "Saved ✓" : saving ? "Saving…" : "Publish"}
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary"
              disabled={saving || !details.title.trim() || winnerSlots.length === 0}
              onClick={() => save(false)}
            >
              {saved ? "Saved ✓" : saving ? "Saving…" : "Save changes"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className={styles.layout}>
        <DetailsSection
          details={details}
          tagDraft={tagDraft}
          onDetailsChange={(patch) => setDetails((current) => ({ ...current, ...patch }))}
          onTagDraftChange={setTagDraft}
          onTagAdd={addTag}
          onTagRemove={(tag) =>
            setDetails((current) => ({
              ...current,
              tags: current.tags.filter((t) => t !== tag),
            }))
          }
        />
        <RequirementsSection
          requirements={requirements}
          onAdd={addRequirement}
          onChange={(id, patch) =>
            setRequirements((current) =>
              current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
            )
          }
          onRemove={(id) =>
            setRequirements((current) => current.filter((item) => item.id !== id))
          }
        />
        <PrizesSection
          currency={currency}
          winnerSlots={winnerSlots}
          totalPool={totalPrizePool(winnerSlots)}
          onCurrencyChange={setCurrency}
          onAdd={addWinnerSlot}
          onRemove={removeWinnerSlot}
          onAmountChange={(rank, amount) =>
            setWinnerSlots((current) =>
              current.map((slot) =>
                slot.rank === rank ? { ...slot, prize_amount: amount } : slot,
              ),
            )
          }
        />
        <SettingsSection
          submissionMode={submissionMode}
          deadline={deadline}
          onSubmissionModeChange={setSubmissionMode}
          onDeadlineChange={setDeadline}
        />
      </div>
    </div>
  );
}
