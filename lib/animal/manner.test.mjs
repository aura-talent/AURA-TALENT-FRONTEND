// lib/animal/manner.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { createMannerTracker } from "./manner.ts";
import { topTraitChips } from "./animals.ts";

test("measures decision time from cardShown to commit", () => {
  const t = createMannerTracker();
  t.cardShown(1000);
  const m = t.commit(3400);
  assert.equal(m.decision_ms, 2400);
  assert.equal(m.direction_changes, 0);
});

test("counts sign flips as direction changes", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(20);   // right
  t.drag(60);   // still right — no change
  t.drag(-30);  // flip 1
  t.drag(-80);
  t.drag(40);   // flip 2
  const m = t.commit(1500);
  assert.equal(m.direction_changes, 2);
});

test("zero drag never counts as a change", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(0);
  t.drag(-10);
  const m = t.commit(100);
  assert.equal(m.direction_changes, 0);
});

test("cardShown resets the tracker for the next card", () => {
  const t = createMannerTracker();
  t.cardShown(0);
  t.drag(10);
  t.drag(-10);
  t.commit(500);
  t.cardShown(2000);
  const m = t.commit(2100);
  assert.equal(m.decision_ms, 100);
  assert.equal(m.direction_changes, 0);
});

test("decision_ms clamps to 0 when clock goes backwards", () => {
  const t = createMannerTracker();
  t.cardShown(1000);
  assert.equal(t.commit(500).decision_ms, 0);
});

test("topTraitChips picks strongest poles and drops weak axes", () => {
  const chips = topTraitChips({
    social: -0.9, motion: -0.2, visibility: 0.7,
    environment: 0.1, autonomy: 0.0, north_star: 0.05,
  });
  assert.deepEqual(chips, ["Heads-down", "Spotlight"]);
});

test("topTraitChips threshold drops a top-n axis below 0.3", () => {
  const chips = topTraitChips(
    {
      social: -0.9, motion: 0.0, visibility: 0.7,
      environment: 0.2, autonomy: 0.0, north_star: 0.0,
    },
    3
  );
  // environment (0.2) is 3rd strongest but under the 0.3 threshold -> only 2 chips
  assert.deepEqual(chips, ["Heads-down", "Spotlight"]);
});
