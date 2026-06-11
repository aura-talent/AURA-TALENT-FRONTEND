"use client";
import { useCallback, useRef, useState } from "react";

export function useRecorder(stream: MediaStream | null) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

  const start = useCallback(() => {
    if (!stream) return;
    chunksRef.current = [];
    const audioOnly = new MediaStream(stream.getAudioTracks());
    const rec = new MediaRecorder(audioOnly, { mimeType: "audio/webm" });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  }, [stream]);

  const stop = useCallback(
    (): Promise<Blob> =>
      new Promise((resolve) => {
        const rec = recorderRef.current;
        if (!rec || rec.state === "inactive") {
          setRecording(false);
          return resolve(new Blob([], { type: "audio/webm" }));
        }
        rec.onstop = () => {
          setRecording(false);
          resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
        };
        rec.stop();
      }),
    [],
  );

  return { start, stop, recording };
}
