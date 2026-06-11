"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { VisionStatus } from "@/hooks/use-vision";

interface Props {
  visionStatus: VisionStatus;
  loadVision: () => void;
  onReady: (stream: MediaStream) => void;
}

export default function DeviceCheck({ visionStatus, loadVision, onReady }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);

  useEffect(() => {
    loadVision();
    let active = true;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: true })
      .then((s) => {
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch(() => {
        setDeviceError(
          "Camera and microphone access is required. Allow access in your " +
            "browser's site settings (the icon next to the address bar), then reload.",
        );
      });
    return () => {
      active = false;
    };
  }, [loadVision]);

  const devicesReady = stream !== null;
  const visionDone = visionStatus === "ready" || visionStatus === "failed";

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Device check</CardTitle>
          <CardDescription>
            Make sure you can see yourself and your face is well lit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deviceError ? (
            <p className="text-sm text-red-500">{deviceError}</p>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="aspect-video w-full rounded-md bg-black object-cover"
              />
              {!devicesReady && <Skeleton className="h-4 w-2/3" />}
              <p className="text-sm text-muted-foreground">
                {visionStatus === "loading" && "Loading vision models…"}
                {visionStatus === "ready" && "Vision models ready."}
                {visionStatus === "failed" &&
                  "Vision models failed to load — the interview will run audio-only."}
              </p>
              <Button
                className="w-full"
                disabled={!devicesReady || !visionDone}
                onClick={() => stream && onReady(stream)}
              >
                {devicesReady && visionDone ? "I'm ready" : "Preparing…"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
