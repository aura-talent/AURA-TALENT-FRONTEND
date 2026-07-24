import assert from "node:assert/strict";
import test from "node:test";
import {
  totalPrizePool,
  formatPrize,
  bountyStatusLabel,
  nextOpenRank,
  isSubmissionComplete,
} from "./bountyHelpers.ts";

test("totalPrizePool sums all winner slot amounts", () => {
  assert.equal(
    totalPrizePool([
      { rank: 1, prize_amount: 500 },
      { rank: 2, prize_amount: 300 },
      { rank: 3, prize_amount: 200 },
    ]),
    1000,
  );
});

test("totalPrizePool returns 0 for no slots", () => {
  assert.equal(totalPrizePool([]), 0);
});

test("formatPrize formats currency and amount", () => {
  assert.equal(formatPrize(1500, "USD"), "USD 1,500");
});

test("bountyStatusLabel maps every status to a label", () => {
  assert.equal(bountyStatusLabel("draft"), "Draft");
  assert.equal(bountyStatusLabel("published"), "Published");
  assert.equal(bountyStatusLabel("closed"), "Closed");
  assert.equal(bountyStatusLabel("winners_announced"), "Winners announced");
});

test("nextOpenRank returns the lowest rank without a winner", () => {
  const slots = [
    { rank: 1, prize_amount: 500 },
    { rank: 2, prize_amount: 300 },
    { rank: 3, prize_amount: 200 },
  ];
  const results = [
    { id: "r1", submission_id: "s1", status: "winner", rank: 1, prize_amount: 500, contacted_at: null, decided_at: null },
  ];
  assert.equal(nextOpenRank(slots, results), 2);
});

test("nextOpenRank returns null when all ranks are taken", () => {
  const slots = [{ rank: 1, prize_amount: 500 }];
  const results = [
    { id: "r1", submission_id: "s1", status: "winner", rank: 1, prize_amount: 500, contacted_at: null, decided_at: null },
  ];
  assert.equal(nextOpenRank(slots, results), null);
});

test("isSubmissionComplete requires every required item to have a non-empty response", () => {
  const items = [
    { id: "a", label: "Design file", description: "", type: "file", required: true },
    { id: "b", label: "Notes", description: "", type: "text", required: false },
  ];
  assert.equal(isSubmissionComplete(items, {}), false);
  assert.equal(
    isSubmissionComplete(items, { a: { type: "file", value: "path/to/file" } }),
    true,
  );
  assert.equal(
    isSubmissionComplete(items, { a: { type: "file", value: "  " } }),
    false,
  );
});
