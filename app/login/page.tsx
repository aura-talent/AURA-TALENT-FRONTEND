"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import Link from "next/link";

function LoginInner() {
  const { user, loading, role: userRole, signInWithGoogle, signInWithLinkedIn, signInWithPassword } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "signin";
  const errorParam = searchParams.get("error");

  const [mode, setMode] = useState<"signin" | "signup">(initialMode);
  const [role, setRole] = useState<"candidate" | "employer" | null>(null);
  const [signingIn, setSigningIn] = useState<"google" | "linkedin" | null>(null);

  // Demo / Prefill Login state
  const [email, setEmail] = useState("candidate@demo.com");
  const [password, setPassword] = useState("demo123456");
  const [demoRole, setDemoRole] = useState<"candidate" | "employer">("candidate");
  const [submittingPassword, setSubmittingPassword] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showManualForm, setShowManualForm] = useState<boolean>(false);

  useEffect(() => {
    if (!loading && user) {
      if (userRole === "employer") {
        router.push("/employer");
      } else {
        // New candidate just signed up — send them to onboarding to upload resume
        const isNewSignup = typeof window !== "undefined" && localStorage.getItem("aura_new_candidate") === "1";
        if (isNewSignup && redirect === "/dashboard") {
          router.push("/onboarding");
        } else {
          router.push(redirect);
        }
      }
    }
  }, [user, loading, userRole, router, redirect]);


  const handleSelectRole = (selectedRole: "candidate" | "employer") => {
    setRole(selectedRole);
    // Flag new candidate signups so we can redirect to /onboarding after auth
    if (mode === "signup" && selectedRole === "candidate") {
      if (typeof window !== "undefined") {
        localStorage.setItem("aura_new_candidate", "1");
      }
    }
  };


  const handleQuickLogin = async (targetRole: "candidate" | "employer") => {
    const targetEmail = targetRole === "employer" ? "employer@auratalent.com" : "candidate@demo.com";
    const targetPass = "demo123456";

    setEmail(targetEmail);
    setPassword(targetPass);
    setDemoRole(targetRole);
    setPasswordError(null);
    setSubmittingPassword(true);

    try {
      await signInWithPassword(targetEmail, targetPass, targetRole);
    } catch (err: any) {
      console.error("Quick login failed:", err);
      setPasswordError(err?.message || "Failed to log in with prefilled account.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setPasswordError(null);
    setSubmittingPassword(true);
    try {
      await signInWithPassword(email, password, demoRole);
    } catch (err: any) {
      console.error("Password login failed:", err);
      setPasswordError(err?.message || "Invalid credentials.");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const handleSignIn = async (provider: "google" | "linkedin") => {
    setSigningIn(provider);
    try {
      if (typeof window !== "undefined") {
        if (mode === "signup" && role) {
          localStorage.setItem("aura_pending_role", role);
        } else {
          localStorage.removeItem("aura_pending_role");
        }
        localStorage.setItem("aura_auth_mode", mode);
      }
      if (provider === "google") await signInWithGoogle();
      if (provider === "linkedin") await signInWithLinkedIn();
    } catch {
      setSigningIn(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("aura_pending_role");
        localStorage.removeItem("aura_auth_mode");
      }
    }
  };

  if (loading) {
    return (
      <div className="auth-shell">
        <div className="thinking">
          <div className="thinking-orb" />
          <p className="thinking-status">Loading session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      {/* Drafting grid background */}
      <div className="auth-grid" aria-hidden="true" />

      {/* Aura ambient glow */}
      <div className="auth-glow" aria-hidden="true" />

      {/* Corner HUD labels */}
      <span className="auth-hud auth-hud-tl" aria-hidden="true">
        (AUTH) // GATEWAY<br />
        AURA_TALENT v1.0
      </span>
      <span className="auth-hud auth-hud-br" aria-hidden="true">
        OAUTH_SECURE<br />
        {mode === "signup" ? "NEW_USER_INIT" : "SESSION_INIT"}
      </span>

      {/* The panel */}
      <div className="auth-panel">
        {/* Registration-tick corners */}
        <span className="auth-tick auth-tick-tl" aria-hidden="true" />
        <span className="auth-tick auth-tick-tr" aria-hidden="true" />
        <span className="auth-tick auth-tick-bl" aria-hidden="true" />
        <span className="auth-tick auth-tick-br" aria-hidden="true" />

        {/* Panel header */}
        <div className="auth-panel-head">
          <div className="auth-logo">
            <svg width="32" height="32" viewBox="0 0 32 32" aria-label="Aura Talent">
              <defs>
                <linearGradient id="auth-aura" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c7b9ff" />
                  <stop offset="50%" stopColor="#ffd9c2" />
                  <stop offset="100%" stopColor="#bfead8" />
                </linearGradient>
              </defs>
              <rect width="32" height="32" rx="8" fill="#1a1d29" />
              <circle
                cx="16" cy="16" r="9"
                fill="none"
                stroke="url(#auth-aura)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray="47.1"
                strokeDashoffset="7.5"
                transform="rotate(-90 16 16)"
              />
            </svg>
            <div>
              <div className="auth-logo-name">Aura Talent</div>
              <div className="auth-logo-sub">{mode === "signup" ? "WORKSPACE_CREATION" : "WORKSPACE_ACCESS"}</div>
            </div>
          </div>
          <div className="auth-status">
            <span className="auth-status-dot" />
            ONLINE
          </div>
        </div>

        {/* Auth Tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => { setMode("signin"); setRole(null); }}
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => setMode("signup")}
          >
            Create Account
          </button>
        </div>

        {/* Main copy */}
        <div className="auth-copy">
          {errorParam === "already_registered" && (
            <div className="notice notice-error" style={{ marginBottom: "1rem" }}>
              You already have an account. Please sign in instead.
            </div>
          )}
          {errorParam === "account_not_found" && (
            <div className="notice notice-error" style={{ marginBottom: "1rem" }}>
              Account not found. Please create an account first.
            </div>
          )}

          <h1 className="auth-heading">{mode === "signin" ? "Welcome back." : "Join Aura."}</h1>
          <p className="auth-sub">
            {mode === "signin"
              ? "Know which jobs deserve you."
              : !role
                ? "Are you looking for jobs or hiring talent?"
                : role === "employer"
                  ? "Sign up as an employer to discover top talent."
                  : "Sign up as a candidate to find jobs that deserve you."
            }
          </p>
        </div>

        <div className="auth-rule" aria-hidden="true" />
        {/* Auth actions (OAuth / Real Login) */}
        <div className="auth-actions">
          {mode === "signup" && !role ? (
            <>
              <button
                onClick={() => handleSelectRole("candidate")}
                className="btn auth-btn auth-btn-candidate"
              >
                I am a Candidate
              </button>
              <button
                onClick={() => handleSelectRole("employer")}
                className="btn auth-btn auth-btn-employer"
              >
                I am an Employer
              </button>
            </>
          ) : (
            <>
              <button
                id="login-google-btn"
                onClick={() => handleSignIn("google")}
                disabled={signingIn !== null || submittingPassword}
                className="btn btn-ghost auth-btn"
              >
                {signingIn === "google" ? (
                  <span className="auth-spinner" />
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.37 0 3.39 2.673 1.486 6.573l3.78 3.192Z" />
                    <path fill="#4285F4" d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.54c-.282 1.505-1.127 2.782-2.395 3.636l3.736 2.9C22.064 19.064 23.64 15.936 23.64 12.273Z" />
                    <path fill="#FBBC05" d="M5.266 14.235 1.486 17.427C3.39 21.327 7.37 24 12 24c3.082 0 5.673-1.009 7.564-2.755l-3.736-2.9c-1.027.691-2.345 1.109-3.828 1.109-2.936 0-5.427-1.982-6.31-4.645l-3.78 3.191Z" />
                    <path fill="#34A853" d="M1.486 6.573A12.016 12.016 0 0 0 1 12c0 1.955.473 3.81 1.305 5.46L6.09 14.27A7.03 7.03 0 0 1 5.266 12c0-1.045.232-2.04.646-2.946L2.126 5.864l-.64 1.127-.001-.418Z" />
                  </svg>
                )}
                {signingIn === "google" ? "Authenticating…" : (mode === "signup" ? "Sign up with Google" : "Continue with Google")}
              </button>
              <button
                id="login-linkedin-btn"
                onClick={() => handleSignIn("linkedin")}
                disabled={signingIn !== null || submittingPassword}
                className="btn auth-btn auth-btn-linkedin"
              >
                {signingIn === "linkedin" ? (
                  <span className="auth-spinner auth-spinner-white" />
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ flexShrink: 0 }}>
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75-1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                  </svg>
                )}
                {signingIn === "linkedin" ? "Authenticating…" : (mode === "signup" ? "Sign up with LinkedIn" : "Continue with LinkedIn")}
              </button>
            </>
          )}
        </div>

        {/* Divider line between real login and judge login */}
        <div className="auth-divider">
          <span>OR DEMO / JUDGE ACCESS</span>
        </div>

        {/* Judge & Demo Quick Login Section */}
        <div className="demo-box">
          <div className="demo-box-head">
            <div className="demo-box-title">
              <span className="demo-status-pulse" />
              <span>ONE-CLICK INSTANT LOGIN</span>
            </div>
            <span className="demo-box-sub">HACKATHON DEMO</span>
          </div>

          <div className="demo-quick-stack">
            <button
              type="button"
              onClick={() => handleQuickLogin("candidate")}
              disabled={submittingPassword || signingIn !== null}
              className="demo-btn demo-btn-cand"
            >
              <div className="demo-btn-left">
                <span className="demo-btn-icon">🚀</span>
                <div className="demo-btn-meta">
                  <span className="demo-btn-name">Demo Candidate</span>
                  <span className="demo-btn-email">candidate@demo.com</span>
                </div>
              </div>
              <span className="demo-btn-arrow">
                {submittingPassword ? "…" : "Login →"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleQuickLogin("employer")}
              disabled={submittingPassword || signingIn !== null}
              className="demo-btn demo-btn-emp"
            >
              <div className="demo-btn-left">
                <span className="demo-btn-icon">🏢</span>
                <div className="demo-btn-meta">
                  <span className="demo-btn-name">Demo Employer</span>
                  <span className="demo-btn-email">employer@auratalent.com</span>
                </div>
              </div>
              <span className="demo-btn-arrow">
                {submittingPassword ? "…" : "Login →"}
              </span>
            </button>
          </div>

          {passwordError && (
            <div className="notice notice-error" style={{ marginTop: "0.85rem", fontSize: "0.8rem" }}>
              {passwordError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="auth-panel-foot">
          {mode === "signup" && role ? (
            <button onClick={() => setRole(null)} className="auth-back" style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              ← BACK
            </button>
          ) : (
            <Link href="/" className="auth-back">
              ← HOME
            </Link>
          )}
          <span className="auth-legal">
            {mode === "signup" ? "Signing up" : "Signing in"} accepts our{" "}
            <a href="#" className="auth-legal-link">Terms</a>{" "}
            &amp;{" "}
            <a href="#" className="auth-legal-link">Privacy</a>
          </span>
        </div>
      </div>

      <style>{`
        /* ── Auth page shell ────────────────────────────────── */
        .auth-shell {
          position: relative;
          min-height: calc(100dvh - 64px);
          display: grid;
          place-items: center;
          padding: 3rem 1.5rem;
          overflow: hidden;
        }

        /* Drafting grid — same as intro-loader */
        .auth-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(26, 29, 41, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(26, 29, 41, 0.04) 1px, transparent 1px);
          background-size: 44px 44px;
        }

        /* Aura glow — same radial gradient as the hero */
        .auth-glow {
          position: absolute;
          inset: -20%;
          pointer-events: none;
          background:
            radial-gradient(38% 42% at 28% 30%, var(--aura-a) 0%, transparent 70%),
            radial-gradient(36% 40% at 74% 38%, var(--aura-b) 0%, transparent 70%),
            radial-gradient(40% 44% at 52% 78%, var(--aura-c) 0%, transparent 70%);
          filter: blur(64px);
          opacity: 0.5;
        }

        /* Corner HUD labels — same font & styling as .hero-hud-label */
        .auth-hud {
          position: absolute;
          font-family: var(--font-space), monospace;
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink-30);
          line-height: 1.7;
          pointer-events: none;
        }
        .auth-hud-tl { top: 1.75rem; left: clamp(1.5rem, 4vw, 3rem); }
        .auth-hud-br { bottom: 1.75rem; right: clamp(1.5rem, 4vw, 3rem); text-align: right; }

        @media (max-width: 600px) {
          .auth-hud { display: none; }
        }

        /* ── The panel — blueprint eval-panel language ─────── */
        .auth-panel {
          position: relative;
          width: 100%;
          max-width: 440px;
          background: rgba(250, 250, 248, 0.82);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid var(--ink-30);
          padding: 2.25rem 2.25rem 1.75rem;
          animation: auth-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        @keyframes auth-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Registration-tick corners — same as .eval-tick */
        .auth-tick {
          position: absolute;
          width: 10px;
          height: 10px;
          pointer-events: none;
        }
        .auth-tick::before,
        .auth-tick::after {
          content: "";
          position: absolute;
          background: var(--ink-55);
        }
        .auth-tick::before { width: 10px; height: 1px; top: 4.5px; }
        .auth-tick::after  { width: 1px; height: 10px; left: 4.5px; }
        .auth-tick-tl { top: -5px; left: -5px; }
        .auth-tick-tr { top: -5px; right: -5px; }
        .auth-tick-bl { bottom: -5px; left: -5px; }
        .auth-tick-br { bottom: -5px; right: -5px; }

        /* ── Panel header row ─────────────────────────────── */
        .auth-panel-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1.4rem;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .auth-logo-name {
          font-family: var(--font-display), sans-serif;
          font-weight: 700;
          font-size: 1rem;
          letter-spacing: -0.01em;
          line-height: 1.2;
          color: var(--ink);
        }

        .auth-logo-sub {
          font-family: var(--font-space), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-30);
          margin-top: 0.1rem;
        }

        .auth-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--font-space), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--score-strong);
        }

        .auth-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--score-strong);
          animation: auth-pulse 2.4s ease-in-out infinite;
        }

        @keyframes auth-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.55; transform: scale(0.85); }
        }

        /* ── Dashed rule ──────────────────────────────────── */
        .auth-rule {
          height: 1px;
          background: repeating-linear-gradient(
            to right,
            var(--ink-30) 0px,
            var(--ink-30) 4px,
            transparent 4px,
            transparent 10px
          );
          margin: 1.35rem 0;
        }

        /* ── Main copy ────────────────────────────────────── */
        .auth-copy {
          margin: 0;
        }

        .auth-kicker {
          font-family: var(--font-space), monospace;
          font-size: 0.6875rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--iris);
          margin-bottom: 0.75rem;
        }

        .auth-heading {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(2rem, 5vw, 2.6rem);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 1.07;
          color: var(--ink);
          margin-bottom: 0.55rem;
          text-wrap: balance;
        }

        .auth-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          background: rgba(26, 29, 41, 0.04);
          padding: 0.25rem;
          border-radius: var(--r-s);
        }

        .auth-tab {
          flex: 1;
          background: transparent;
          border: none;
          padding: 0.5rem;
          font-family: var(--font-space), monospace;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--ink-55);
          cursor: pointer;
          border-radius: calc(var(--r-s) - 0.15rem);
          transition: background 0.2s, color 0.2s;
        }

        .auth-tab:hover {
          color: var(--ink);
        }

        .auth-tab.active {
          background: #fff;
          color: var(--ink);
          box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }

        .auth-sub {
          font-size: 0.9375rem;
          color: var(--ink-55);
          line-height: 1.55;
        }

        /* ── Divider between Real Auth & Demo ─────────────── */
        .auth-divider {
          display: flex;
          align-items: center;
          text-align: center;
          margin: 1.5rem 0 1.25rem;
          color: var(--ink-30);
        }

        .auth-divider::before,
        .auth-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px dashed var(--ink-12);
        }

        .auth-divider span {
          padding: 0 0.75rem;
          font-family: var(--font-space), monospace;
          font-size: 0.625rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-55);
        }

        /* ── Demo Quick Access Box ────────────────────────── */
        .demo-box {
          background: rgba(26, 29, 41, 0.03);
          border: 1px solid var(--ink-12);
          border-radius: var(--r-s);
          padding: 1.15rem;
          margin-bottom: 0;
        }

        .demo-box-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.85rem;
        }

        .demo-box-title {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-family: var(--font-space), monospace;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: var(--ink);
          text-transform: uppercase;
        }

        .demo-status-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--score-strong);
          box-shadow: 0 0 8px var(--score-strong);
          animation: auth-pulse 2s infinite ease-in-out;
        }

        .demo-box-sub {
          font-family: var(--font-space), monospace;
          font-size: 0.6rem;
          letter-spacing: 0.06em;
          color: var(--ink-55);
          text-transform: uppercase;
        }

        .demo-quick-stack {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .demo-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: var(--r-s);
          border: 1px solid var(--ink-12);
          background: #ffffff;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
        }

        .demo-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(26, 29, 41, 0.08);
          border-color: var(--iris);
        }

        .demo-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .demo-btn-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .demo-btn-icon {
          font-size: 1.25rem;
          line-height: 1;
        }

        .demo-btn-meta {
          display: flex;
          flex-direction: column;
          line-height: 1.25;
        }

        .demo-btn-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--ink);
        }

        .demo-btn-email {
          font-family: var(--font-space), monospace;
          font-size: 0.6875rem;
          color: var(--ink-55);
        }

        .demo-btn-arrow {
          font-family: var(--font-space), monospace;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--iris);
          transition: transform 0.15s ease;
        }

        .demo-btn:hover .demo-btn-arrow {
          transform: translateX(3px);
        }

        /* ── Auth buttons ─────────────────────────────────── */
        .auth-actions {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
          margin-bottom: 0;
        }

        /* Override .btn pill radius to match eval-panel square language */
        .auth-btn {
          width: 100%;
          justify-content: center;
          border-radius: var(--r-s) !important;
          padding: 0.78rem 1.4rem !important;
          font-size: 0.9375rem !important;
          gap: 0.6rem;
          transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
        }

        .auth-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          pointer-events: none;
        }

        .auth-btn-candidate {
          background: var(--iris);
          color: #fff;
          border: none;
        }

        .auth-btn-candidate:hover {
          background: var(--iris-deep);
          transform: translateY(-1px);
        }

        .auth-btn-employer {
          background: var(--ink);
          color: #fff;
          border: none;
        }

        .auth-btn-employer:hover {
          background: rgba(26, 29, 41, 0.85);
          transform: translateY(-1px);
        }

        .auth-btn-linkedin {
          background: #0077b5;
          color: #fff;
          box-shadow: 0 2px 12px rgba(0, 119, 181, 0.22);
          border: none;
        }

        .auth-btn-linkedin:hover {
          background: #006399;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(0, 119, 181, 0.32);
        }

        .auth-btn-linkedin:active {
          transform: translateY(0);
        }

        /* ── Spinner ──────────────────────────────────────── */
        .auth-spinner {
          display: inline-block;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          border: 1.5px solid var(--ink-30);
          border-top-color: var(--iris);
          animation: auth-spin 0.65s linear infinite;
          flex-shrink: 0;
        }

        .auth-spinner-white {
          border-color: rgba(255,255,255,0.3);
          border-top-color: #fff;
        }

        @keyframes auth-spin {
          to { transform: rotate(360deg); }
        }

        /* ── Panel footer ─────────────────────────────────── */
        .auth-panel-foot {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          border-top: 1px dashed var(--ink-12);
          padding-top: 1.25rem;
          margin-top: 1.35rem;
        }

        .auth-back {
          font-family: var(--font-space), monospace;
          font-size: 0.6875rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--ink-55);
          text-decoration: none;
          transition: color 0.15s;
        }

        .auth-back:hover {
          color: var(--iris);
        }

        .auth-legal {
          font-size: 0.775rem;
          color: var(--ink-30);
          line-height: 1.5;
          text-align: right;
        }

        .auth-legal-link {
          color: var(--ink-55);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s;
        }

        .auth-legal-link:hover { color: var(--iris); }

        /* ── Reduced motion ───────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .auth-panel, .auth-status-dot {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
