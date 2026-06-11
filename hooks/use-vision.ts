"use client";
import { useCallback, useRef, useState } from "react";
import {
  FaceLandmarker,
  GestureRecognizer,
  FilesetResolver,
} from "@mediapipe/tasks-vision";
import {
  computeEyeContact,
  matrixToYawPitch,
  type VisionFrame,
} from "@/lib/telemetry";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const FACE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const GESTURE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

const SAMPLE_INTERVAL_MS = 100;

export type VisionStatus = "idle" | "loading" | "ready" | "failed";

type Landmark = { x: number; y: number; z: number };

function bounds(lm: Landmark[], w: number, h: number) {
  const xs = lm.map((p) => p.x * w);
  const ys = lm.map((p) => p.y * h);
  return {
    x: Math.min(...xs), y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    h: Math.max(...ys) - Math.min(...ys),
  };
}

function drawBox(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; w: number; h: number },
  color: string,
  label: string,
) {
  const pad = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.strokeRect(b.x - pad, b.y - pad, b.w + pad * 2, b.h + pad * 2);
  ctx.shadowBlur = 0;
  ctx.fillStyle = color;
  ctx.font = "bold 12px monospace";
  ctx.fillText(label, b.x - pad, b.y - pad - 4);
}

function drawOverlay(
  canvas: HTMLCanvasElement,
  faceLm: Landmark[] | null,
  handLms: Landmark[][],
  eyeContact: boolean | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;

  if (faceLm && faceLm.length > 0) {
    const b = bounds(faceLm, w, h);
    // green = eye contact, yellow = looking away
    const color = eyeContact === false ? "#facc15" : "#22c55e";
    const label = eyeContact === false ? "FACE (looking away)" : "FACE";
    drawBox(ctx, b, color, label);
  }

  handLms.forEach((lm, i) => {
    if (lm.length === 0) return;
    const b = bounds(lm, w, h);
    // first hand = red, second hand = yellow
    const color = i === 0 ? "#ef4444" : "#facc15";
    drawBox(ctx, b, color, `HAND ${i + 1}`);
  });
}

export function useVision() {
  const [status, setStatus] = useState<VisionStatus>("idle");
  const faceRef = useRef<FaceLandmarker | null>(null);
  const gestureRef = useRef<GestureRecognizer | null>(null);
  const framesRef = useRef<VisionFrame[]>([]);
  const runningRef = useRef(false);
  const startTimeRef = useRef(0);

  const load = useCallback(async () => {
    if (faceRef.current) return;
    setStatus("loading");
    try {
      const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
      faceRef.current = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        outputFacialTransformationMatrixes: true,
        numFaces: 1,
      });
      gestureRef.current = await GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: GESTURE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
      });
      setStatus("ready");
    } catch (err) {
      console.error("MediaPipe failed to load:", err);
      setStatus("failed");
    }
  }, []);

  const analyzeFrame = useCallback((
    video: HTMLVideoElement,
    now: number,
    canvas?: HTMLCanvasElement | null,
  ): VisionFrame | null => {
    const face = faceRef.current;
    const gesture = gestureRef.current;
    if (!face || !gesture) return null;
    try {
      const f = face.detectForVideo(video, now);
      const g = gesture.recognizeForVideo(video, now);
      const lm = f.faceLandmarks?.[0];

      let eyeContact: boolean | null = null;
      let yaw: number | null = null;
      let pitch: number | null = null;
      if (lm && lm.length > 473) {
        eyeContact = computeEyeContact(
          { iris: lm[473].x, a: lm[362].x, b: lm[263].x },
          { iris: lm[468].x, a: lm[33].x, b: lm[133].x },
        );
        const m = f.facialTransformationMatrixes?.[0]?.data;
        if (m) {
          const yp = matrixToYawPitch(Array.from(m));
          yaw = yp.yaw;
          pitch = yp.pitch;
        }
      }
      const hasGesture = (g.gestures ?? []).some(
        (hand) => hand[0] && hand[0].categoryName !== "None" && hand[0].score > 0.5,
      );

      if (canvas) drawOverlay(canvas, lm ?? null, g.landmarks ?? [], eyeContact);

      return { t: now - startTimeRef.current, eyeContact, yaw, pitch, gesture: hasGesture };
    } catch {
      return null;
    }
  }, []);

  const start = useCallback((video: HTMLVideoElement, canvas?: HTMLCanvasElement | null) => {
    framesRef.current = [];
    runningRef.current = true;
    startTimeRef.current = performance.now();
    let lastSample = 0;
    const loop = () => {
      if (!runningRef.current) {
        if (canvas) {
          const ctx = canvas.getContext("2d");
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
      }
      const now = performance.now();
      if (now - lastSample >= SAMPLE_INTERVAL_MS && video.readyState >= 2) {
        lastSample = now;
        const frame = analyzeFrame(video, now, canvas);
        if (frame) framesRef.current.push(frame);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, [analyzeFrame]);

  const stop = useCallback((): VisionFrame[] => {
    runningRef.current = false;
    return framesRef.current;
  }, []);

  return { status, load, start, stop };
}
