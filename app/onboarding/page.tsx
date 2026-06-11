"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ResumeData } from "@/lib/api";
import Thinking from "@/components/Thinking";
import ReportView from "@/components/ReportView";

import { useAuth } from "@/components/AuthProvider";

type Mode = "upload" | "paste";

export default function Onboarding() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [existing, setExisting] = useState<ResumeData | null>(null);
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<ResumeData | null>(null);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login?redirect=/onboarding");
      } else {
        api.getResume()
          .then(setExisting)
          .catch(() => {})
          .finally(() => setChecked(true));
      }
    }
  }, [user, authLoading, router]);

  async function handleFile(file: File) {
    setError("");
    setBusy(true);
    try {
      setDone(await api.uploadResume(file));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Upload failed — try again or paste the text instead.");
    } finally {
      setBusy(false);
    }
  }

  async function handleText() {
    setError("");
    setBusy(true);
    try {
      setDone(await api.submitResumeText(text));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || !user || !checked) {
    return (
      <div className="container" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div className="thinking">
          <div className="thinking-orb" />
          <p className="thinking-status">Loading onboarding session…</p>
        </div>
      </div>
    );
  }

  if (busy) {
    return (
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-head"><h1>Reading your resume</h1></div>
        <div className="panel">
          <Thinking lines={[
            "Reading your resume…",
            "Structuring your experience…",
            "Extracting your strongest signals…",
          ]} />
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <h1>Resume saved</h1>
          <p>This is how Aura reads you. Every evaluation starts from here.</p>
        </div>
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <ReportView markdown={done.markdown} />
        </div>
        <div className="hero-ctas" style={{ paddingBottom: "3rem" }}>
          <button className="btn btn-primary" onClick={() => router.push("/evaluate")}>
            Evaluate your first job
          </button>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>
            Replace resume
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 760, paddingBottom: "4rem" }}>
      <div className="page-head">
        <h1>{existing ? "Your resume" : "Start with your resume"}</h1>
        <p>
          {existing
            ? "Aura already has your resume. Upload a new file to replace it, or head straight to evaluating."
            : "Aura needs your resume once. After that, every job you paste gets scored against it."}
        </p>
      </div>

      {existing && checked && (
        <div className="notice notice-info">
          Resume on file ✓ —{" "}
          <a href="/evaluate" style={{ fontWeight: 600 }}>evaluate a job</a>{" "}
          or replace it below.
        </div>
      )}
      {error && <div className="notice notice-error">{error}</div>}

      <div className="panel">
        <div className="tabs" role="tablist">
          <button className="tab" role="tab" aria-selected={mode === "upload"} onClick={() => setMode("upload")}>
            Upload a file
          </button>
          <button className="tab" role="tab" aria-selected={mode === "paste"} onClick={() => setMode("paste")}>
            Paste text
          </button>
        </div>

        {mode === "upload" ? (
          <div
            className={drag ? "dropzone drag" : "dropzone"}
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && fileInput.current?.click()}
          >
            <p><strong>Drop your resume here</strong> or click to browse</p>
            <p className="mono" style={{ marginTop: "0.5rem" }}>PDF · DOCX · TXT · MD — max 5 MB</p>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.docx,.txt,.md"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="resume-text">Resume text</label>
              <textarea
                id="resume-text"
                className="input"
                placeholder="Paste your full resume — experience, projects, education, skills…"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </div>
            <button
              className="btn btn-primary"
              disabled={text.trim().length < 100}
              onClick={handleText}
            >
              Save resume
            </button>
          </>
        )}
      </div>
    </div>
  );
}
