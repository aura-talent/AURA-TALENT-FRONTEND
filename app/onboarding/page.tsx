"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, ApiError, type ResumeData } from "@/lib/api";
import Thinking from "@/components/Thinking";
import ReportView from "@/components/ReportView";

import { useAuth } from "@/components/AuthProvider";

type Mode = "upload" | "paste";

export default function Onboarding() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("upload");
  const [existing, setExisting] = useState<ResumeData | null>(null);
  const [checked, setChecked] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<ResumeData | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);

  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login?redirect=/onboarding");
      } else {
        // Detect new signup flag set by login page
        const newCandidate = typeof window !== "undefined" && localStorage.getItem("aura_new_candidate") === "1";
        setIsNewUser(newCandidate);
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
      const result = await api.uploadResume(file);
      // Clear the new-user flag now that resume is uploaded
      if (typeof window !== "undefined") {
        localStorage.removeItem("aura_new_candidate");
      }
      setDone(result);
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
      const result = await api.submitResumeText(text);
      // Clear the new-user flag now that resume is uploaded
      if (typeof window !== "undefined") {
        localStorage.removeItem("aura_new_candidate");
      }
      setDone(result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }

  const showIntake = checked && !busy && !done;

  /* intake entrance: head prints, the resume panel rises */
  useEffect(() => {
    if (!showIntake) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 }).from(
        q(".resume-panel"),
        { y: 26, autoAlpha: 0, duration: 0.65 },
        "-=0.3"
      );
    });
    return () => mm.revert();
  }, [showIntake]);

  /* saved view: head prints, the parsed profile rises, CTAs land */
  useEffect(() => {
    if (!done) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 })
        .from(q(".resume-saved-panel"), { y: 30, autoAlpha: 0, duration: 0.7 }, "-=0.3")
        .from(q(".hero-ctas .btn"), { y: 14, autoAlpha: 0, duration: 0.45, stagger: 0.08 }, "-=0.3");
    });
    return () => mm.revert();
  }, [done]);

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
      <div className="app-sheet" ref={root}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <div className="page-kicker">RESUME_PARSER // RUNNING</div>
          <h1>Reading your resume</h1>
        </div>
        <div className="panel">
          <Thinking lines={[
            "Reading your resume…",
            "Structuring your experience…",
            "Extracting your strongest signals…",
          ]} />
        </div>
      </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="app-sheet" ref={root}>
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="page-head">
          <div className="page-kicker">(02) // RESUME_PROFILE</div>
          <h1>{isNewUser ? "You're all set! 🎉" : "Resume saved"}</h1>
          <p>
            {isNewUser
              ? "Welcome to Aura. Your resume is loaded — start exploring jobs that actually fit you."
              : "This is how Aura reads you. Every evaluation starts from here."}
          </p>
        </div>
        <div className="panel resume-saved-panel" style={{ marginBottom: "1.5rem" }}>
          <ReportView markdown={done.markdown} />
        </div>
        <div className="hero-ctas" style={{ paddingBottom: "3rem" }}>
          <button
            className="btn btn-primary"
            onClick={() => router.push(isNewUser ? "/profile?welcome=1" : "/evaluate")}
          >
            {isNewUser ? "Review your profile →" : "Evaluate your first job"}
          </button>
          <button className="btn btn-ghost" onClick={() => setDone(null)}>
            Replace resume
          </button>
        </div>
      </div>
      </div>
    );
  }

  return (
    <div className="app-sheet" ref={root}>
    <div className="container" style={{ maxWidth: 760, paddingBottom: "4rem" }}>
      <div className="page-head">
        <div className="page-kicker">(01) // RESUME_INTAKE</div>
        <h1>
          {isNewUser
            ? "Upload your resume to get started"
            : existing ? "Your resume" : "Start with your resume"}
        </h1>
        <p>
          {isNewUser
            ? "Aura needs your resume once. After that, every job you explore gets scored against your real profile."
            : existing
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

      <div className="panel resume-panel">
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
    </div>
  );
}
