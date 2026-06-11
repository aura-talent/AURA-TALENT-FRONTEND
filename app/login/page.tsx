"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import Link from "next/link";

function LoginInner() {
  const { user, loading, signInWithGoogle, signInWithLinkedIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";

  useEffect(() => {
    if (!loading && user) {
      router.push(redirect);
    }
  }, [user, loading, router, redirect]);

  const handleSignIn = async (provider: "google" | "linkedin") => {
    if (provider === "google") await signInWithGoogle();
    if (provider === "linkedin") await signInWithLinkedIn();
  };

  if (loading) {
    return (
      <div className="container" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div className="thinking">
          <div className="thinking-orb" />
          <p className="thinking-status">Loading session…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        minHeight: "85vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        padding: "2rem 1rem",
      }}
    >
      {/* Background Aura Glow */}
      <div className="aura-glow" style={{ opacity: 0.5, transform: "scale(0.8)" }} />

      <div
        className="panel"
        style={{
          width: "100%",
          maxWidth: "420px",
          position: "relative",
          zIndex: 1,
          textAlign: "center",
          padding: "3rem 2.2rem",
          borderRadius: "var(--r-l)",
          background: "rgba(255, 255, 255, 0.85)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(26, 29, 41, 0.08)",
          boxShadow: "var(--shadow-lift)",
        }}
      >
        <div style={{ marginBottom: "2rem" }}>
          <svg
            width="38"
            height="38"
            viewBox="0 0 32 32"
            aria-hidden="true"
            style={{ margin: "0 auto 1.25rem", display: "block" }}
          >
            <defs>
              <linearGradient id="login-aura" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#c7b9ff" />
                <stop offset="50%" stopColor="#ffd9c2" />
                <stop offset="100%" stopColor="#bfead8" />
              </linearGradient>
            </defs>
            <rect width="32" height="32" rx="8" fill="#1a1d29" />
            <circle
              cx="16"
              cy="16"
              r="9"
              fill="none"
              stroke="url(#login-aura)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="47.1"
              strokeDashoffset="7.5"
              transform="rotate(-90 16 16)"
            />
          </svg>
          <h1 style={{ fontSize: "1.75rem", marginBottom: "0.5rem" }}>Welcome to Aura</h1>
          <p style={{ color: "var(--ink-72)", fontSize: "0.9375rem" }}>
            Sign in to access your workspace.
          </p>
        </div>

        <div style={{ marginBottom: "2rem" }}>
          <button
            onClick={() => handleSignIn("google")}
            className="btn btn-ghost"
            style={{
              justifyContent: "center",
              width: "100%",
              background: "#fff",
              border: "1.5px solid var(--ink-12)",
              color: "var(--ink)",
              boxShadow: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: "0.25rem" }}>
              <path
                fill="#EA4335"
                d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.37 0 3.39 2.673 1.486 6.573l3.78 3.192Z"
              />
              <path
                fill="#4285F4"
                d="M23.64 12.273c0-.818-.073-1.609-.208-2.373H12v4.582h6.54c-.282 1.505-1.127 2.782-2.395 3.636l3.736 2.9C22.064 19.064 23.64 15.936 23.64 12.273Z"
              />
              <path
                fill="#FBBC05"
                d="M5.266 14.235 1.486 17.427C3.39 21.327 7.37 24 12 24c3.082 0 5.673-1.009 7.564-2.755l-3.736-2.9c-1.027.691-2.345 1.109-3.828 1.109-2.936 0-5.427-1.982-6.31-4.645l-3.78 3.191Z"
              />
              <path
                fill="#34A853"
                d="M1.486 6.573A12.016 12.016 0 0 0 1 12c0 1.955.473 3.81 1.305 5.46L6.09 14.27A7.03 7.03 0 0 1 5.266 12c0-1.045.232-2.04.646-2.946L2.126 5.864l-.64 1.127l-.001-.418Z"
              />
            </svg>
            Continue with Google
          </button>

          <button
            onClick={() => handleSignIn("linkedin")}
            className="btn btn-primary"
            style={{
              justifyContent: "center",
              width: "100%",
              background: "#0077b5",
              color: "#fff",
              boxShadow: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: "0.25rem" }} fill="currentColor">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
            Continue with LinkedIn
          </button>
        </div>

        <div style={{ borderTop: "1px solid var(--ink-06)", paddingTop: "1.5rem" }}>
          <Link href="/" className="btn btn-ghost" style={{ fontSize: "0.875rem", padding: "0.45rem 1rem" }}>
            ← Back to home
          </Link>
        </div>
      </div>
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
