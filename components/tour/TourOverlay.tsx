"use client";

import { useEffect, useState } from "react";
import { useTour } from "./TourProvider";

const FIND_TIMEOUT_MS = 1500;
const FIND_INTERVAL_MS = 100;

export default function TourOverlay() {
  const { active, currentStep, stepIndex, stepNumber, totalSteps, next, back, skipTour } =
    useTour();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    console.log("[tour] overlay effect fired, active =", active, "currentStep =", currentStep);
    if (!active || !currentStep) return;

    let cancelled = false;
    let elapsed = 0;
    let clearedStaleRect = false;

    // Deferred via setTimeout(0) rather than called synchronously here — every
    // setState call below runs inside this async callback boundary, not in
    // the effect body itself.
    function poll() {
      if (cancelled || !currentStep) return;
      const el = document.querySelector(currentStep.selector);
      if (el) {
        console.log("[tour] found target for selector", currentStep.selector);
        setRect(el.getBoundingClientRect());
        setNotFound(false);
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        return;
      }
      if (!clearedStaleRect) {
        setRect(null);
        clearedStaleRect = true;
      }
      elapsed += FIND_INTERVAL_MS;
      if (elapsed >= FIND_TIMEOUT_MS) {
        console.log("[tour] TIMED OUT looking for selector", currentStep.selector, "— advancing");
        setNotFound(true);
        return;
      }
      window.setTimeout(poll, FIND_INTERVAL_MS);
    }
    window.setTimeout(poll, 0);

    return () => {
      cancelled = true;
    };
  }, [active, currentStep]);

  // A target that never appears (e.g. an empty-state page) shouldn't hang
  // the tour — skip forward instead.
  useEffect(() => {
    if (notFound) next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notFound]);

  useEffect(() => {
    if (!active || !currentStep) return;
    function reposition() {
      if (!currentStep) return;
      const el = document.querySelector(currentStep.selector);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [active, currentStep]);

  if (!active || !currentStep || !rect) return null;

  const pad = 8;
  const spotlightTop = rect.top - pad;
  const spotlightLeft = rect.left - pad;
  const spotlightWidth = rect.width + pad * 2;
  const spotlightHeight = rect.height + pad * 2;
  const tooltipTop = Math.min(
    spotlightTop + spotlightHeight + 12,
    window.innerHeight - 220,
  );
  const tooltipLeft = Math.min(Math.max(spotlightLeft, 16), window.innerWidth - 336);

  return (
    <div className="tour-overlay">
      <div
        className="tour-spotlight"
        style={{
          top: spotlightTop,
          left: spotlightLeft,
          width: spotlightWidth,
          height: spotlightHeight,
        }}
      />
      <div className="tour-tooltip" style={{ top: tooltipTop, left: tooltipLeft }}>
        <span className="tour-tooltip-step">
          Step {stepNumber} of {totalSteps}
        </span>
        <h4>{currentStep.title}</h4>
        <p>{currentStep.body}</p>
        <div className="tour-tooltip-actions">
          <button className="btn btn-ghost" onClick={skipTour}>
            Skip tour
          </button>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {stepIndex > 0 && (
              <button className="btn btn-ghost" onClick={back}>
                Back
              </button>
            )}
            <button className="btn btn-primary" onClick={next}>
              {stepNumber === totalSteps ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
