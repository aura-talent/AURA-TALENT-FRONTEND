export type RequirementType = "file" | "link" | "text";

export type RequirementItem = {
  id: string;
  label: string;
  description: string;
  type: RequirementType;
  required: boolean;
};

export type WinnerSlot = {
  rank: number;
  prize_amount: number;
};

export type SubmissionMode = "individual" | "team" | "both";
export type BountyStatus = "draft" | "published" | "closed" | "winners_announced";

export interface Bounty {
  id: string;
  employer_id: string;
  title: string;
  tags: string[];
  rules_text: string | null;
  requirement_items: RequirementItem[];
  submission_mode: SubmissionMode;
  winner_slots: WinnerSlot[];
  currency: string;
  deadline: string | null;
  status: BountyStatus;
  published_at: string | null;
  closed_at: string | null;
  winners_announced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type TeamMember = { name: string; email: string };
export type RequirementResponse = { type: RequirementType; value: string };

export interface BountySubmission {
  id: string;
  bounty_id: string;
  candidate_user_id: string;
  contact_name: string;
  contact_email: string;
  team_members: TeamMember[];
  responses: Record<string, RequirementResponse>;
  notes: string | null;
  submitted_at: string;
  updated_at: string;
}

export type SubmissionResultStatus = "pending" | "winner" | "not_selected";

export interface SubmissionResult {
  id: string;
  submission_id: string;
  status: SubmissionResultStatus;
  rank: number | null;
  prize_amount: number | null;
  contacted_at: string | null;
  decided_at: string | null;
}

export type SubmissionWithResult = BountySubmission & { result: SubmissionResult | null };

export type CandidateBountyHistory = {
  submission: BountySubmission;
  bounty: Pick<Bounty, "id" | "title" | "currency" | "winner_slots">;
  result: SubmissionResult | null;
};


export type BountyEditorMode = "create" | "edit";

export type BountyPayload = Partial<
  Pick<
    Bounty,
    | "title"
    | "tags"
    | "rules_text"
    | "requirement_items"
    | "submission_mode"
    | "winner_slots"
    | "currency"
    | "deadline"
  >
>;

export type SubmissionPayload = {
  contact_name: string;
  contact_email: string;
  team_members: TeamMember[];
  responses: Record<string, RequirementResponse>;
  notes: string;
};

export function totalPrizePool(winnerSlots: WinnerSlot[]): number {
  return winnerSlots.reduce((total, slot) => total + slot.prize_amount, 0);
}

export function formatPrize(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

export function formatRankLabel(rank: number): string {
  switch (rank) {
    case 1:
      return "First Place";
    case 2:
      return "Follow-up";

    case 3:
      return "Third Place";
    case 4:
      return "Fourth Place";
    case 5:
      return "Fifth Place";
    default:
      return `Rank ${rank}`;
  }
}


export function bountyStatusLabel(status: BountyStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "published":
      return "Published";
    case "closed":
      return "Closed";
    case "winners_announced":
      return "Winners announced";
  }
}

export function formatDeadline(iso: string | null): string {
  if (!iso) return "No deadline";
  const deadline = new Date(iso).getTime();
  const now = Date.now();
  if (deadline <= now) return "Deadline passed";
  const days = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  return days <= 1 ? "Closes in 1 day" : `Closes in ${days} days`;
}

export function nextOpenRank(
  winnerSlots: WinnerSlot[],
  results: SubmissionResult[],
): number | null {
  const takenRanks = new Set(
    results.filter((r) => r.status === "winner" && r.rank != null).map((r) => r.rank),
  );
  const sorted = [...winnerSlots].sort((a, b) => a.rank - b.rank);
  const open = sorted.find((slot) => !takenRanks.has(slot.rank));
  return open ? open.rank : null;
}

export function isSubmissionComplete(
  items: RequirementItem[],
  responses: Record<string, RequirementResponse>,
): boolean {
  return items
    .filter((item) => item.required)
    .every((item) => {
      const response = responses[item.id];
      return Boolean(response && response.value.trim().length > 0);
    });
}
