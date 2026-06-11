import type { Telemetry } from "@/lib/schemas";

export interface VisionFrame {
  /** ms since recording start */
  t: number;
  /** null = no face detected this frame */
  eyeContact: boolean | null;
  /** head yaw in degrees, null when no face */
  yaw: number | null;
  /** head pitch in degrees, null when no face */
  pitch: number | null;
  /** a recognized hand gesture is present this frame */
  gesture: boolean;
}

interface EyeReading {
  iris: number; // normalized x of iris center
  a: number;    // normalized x of one eye corner
  b: number;    // normalized x of the other eye corner
}

const GAZE_CENTER_MIN = 0.35;
const GAZE_CENTER_MAX = 0.65;

export function computeEyeContact(left: EyeReading, right: EyeReading): boolean {
  const ratio = (e: EyeReading) => (e.iris - e.a) / (e.b - e.a);
  const ok = (r: number) => r >= GAZE_CENTER_MIN && r <= GAZE_CENTER_MAX;
  return ok(ratio(left)) && ok(ratio(right));
}

/** Extract yaw/pitch (degrees) from a column-major 4x4 transformation matrix. */
export function matrixToYawPitch(m: number[]): { yaw: number; pitch: number } {
  const yaw = Math.atan2(m[8], m[10]);
  const pitch = Math.asin(Math.max(-1, Math.min(1, -m[9])));
  const deg = (r: number) => (r * 180) / Math.PI;
  return { yaw: deg(yaw), pitch: deg(pitch) };
}

const DEVIATION_MIN_MS = 500;

function stdDev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
}

export function aggregateTelemetry(
  frames: VisionFrame[],
  durationMs: number,
): Telemetry | null {
  const faced = frames.filter((fr) => fr.eyeContact !== null);
  if (faced.length === 0) return null;

  // Eye contact percentage
  const contactCount = faced.filter((fr) => fr.eyeContact === true).length;
  const eyeContactPercentage = Math.round((contactCount / faced.length) * 100);

  // Gaze deviations: away-streaks lasting > DEVIATION_MIN_MS
  let gazeDeviationsCount = 0;
  let awayStart: number | null = null;
  let lastT = 0;
  for (const fr of faced) {
    lastT = fr.t;
    if (fr.eyeContact === false) {
      if (awayStart === null) awayStart = fr.t;
    } else {
      if (awayStart !== null && fr.t - awayStart > DEVIATION_MIN_MS) {
        gazeDeviationsCount++;
      }
      awayStart = null;
    }
  }
  if (awayStart !== null && lastT - awayStart > DEVIATION_MIN_MS) {
    gazeDeviationsCount++;
  }

  // Head pose instability: combined yaw+pitch spread in degrees
  const yaws = faced.map((fr) => fr.yaw).filter((v): v is number => v !== null);
  const pitches = faced
    .map((fr) => fr.pitch)
    .filter((v): v is number => v !== null);
  const spread = Math.sqrt(stdDev(yaws) ** 2 + stdDev(pitches) ** 2);
  const headPoseInstability: Telemetry["headPoseInstability"] =
    spread < 3 ? "low" : spread < 8 ? "moderate" : "high";

  // Gesture frequency: rising edges per minute
  let gestureEvents = 0;
  let prevGesture = false;
  for (const fr of frames) {
    if (fr.gesture && !prevGesture) gestureEvents++;
    prevGesture = fr.gesture;
  }
  const perMinute = gestureEvents / (durationMs / 60_000);
  const handGestureFrequency: Telemetry["handGestureFrequency"] =
    gestureEvents === 0
      ? "none"
      : perMinute < 4
        ? "low"
        : perMinute < 10
          ? "moderate"
          : "high";

  return {
    eyeContactPercentage,
    gazeDeviationsCount,
    headPoseInstability,
    handGestureFrequency,
  };
}
