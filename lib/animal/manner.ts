/**
 * Swipe *manner* tracker — the temperament signal. Pure logic, no DOM:
 * decision time per card and horizontal-drag sign flips (hesitation).
 * Timestamps are injectable so tests never depend on wall clock.
 * Callers must call cardShown() before commit(); commit without it reads from t=0.
 */

export interface MannerReading {
  decision_ms: number;
  direction_changes: number;
}

export function createMannerTracker() {
  let shownAt = 0;
  let changes = 0;
  let lastSign = 0;

  return {
    cardShown(now: number = performance.now()) {
      shownAt = now;
      changes = 0;
      lastSign = 0;
    },
    drag(dx: number) {
      const sign = Math.sign(dx);
      if (sign === 0) return;
      if (lastSign !== 0 && sign !== lastSign) changes += 1;
      lastSign = sign;
    },
    commit(now: number = performance.now()): MannerReading {
      return {
        decision_ms: Math.max(0, Math.round(now - shownAt)),
        direction_changes: changes,
      };
    },
  };
}
