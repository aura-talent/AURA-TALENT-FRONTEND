"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useState } from "react";

const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/evaluate", label: "EVALUATE" },
  { href: "/jobs", label: "FIND_JOBS" },
  { href: "/compare", label: "COMPARE" },
  { href: "/scan", label: "SCAN_JOBS" },
  { href: "/mock-interview", label: "MOCK_INTERVIEW" },
];

const EMPLOYER_LINKS = [
  { href: '/employer', label: 'OVERVIEW' },
  { href: '/employer/candidates', label: 'CANDIDATES' },
  { href: '/employer/jobs', label: 'JOBS' },
  { href: '/employer/interviews', label: 'INTERVIEWS' },
];

export default function Nav() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const onEmployer = pathname.startsWith("/employer");
  const { user, loading, role, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isEmployerMode = role === "employer";
  const links = isEmployerMode ? EMPLOYER_LINKS : APP_LINKS;

  return (
    <header className="nav nav-blueprint">
      <div className="nav-inner">
        <Link href="/" className="nav-brand">
          <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="nav-aura" x1="0" y1="0" x2="1" y2="1">
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
              stroke="url(#nav-aura)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeDasharray="47.1"
              strokeDashoffset="7.5"
              transform="rotate(-90 16 16)"
            />
          </svg>
          AURA_TALENT
        </Link>
        <nav className="nav-links">
          {onEmployer ? (
            <span className="nav-workspace mono">Employer workspace</span>
          ) : onLanding ? (
            <>
              <a href="#how">HOW_IT_WORKS</a>
              <a href="#report">THE_REPORT</a>
              <Link href={role === "employer" ? "/employer" : "/dashboard"}>{role === "employer" ? "EMPLOYER_WORKSPACE" : "DASHBOARD"}</Link>
              {loading ? (
                <span
                  className="mono"
                  style={{ fontSize: "0.85rem", opacity: 0.5 }}
                >
                  Loading...
                </span>
              ) : user ? (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "transparent",
                      border: "none",
                      color: "var(--ink)",
                      padding: 0,
                    }}
                  >
                    {user.user_metadata?.avatar_url ||
                      user.user_metadata?.picture ? (
                      <img
                        src={
                          user.user_metadata.avatar_url ||
                          user.user_metadata.picture
                        }
                        alt="Profile"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "1px solid var(--ink-12)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "var(--iris-12)",
                          color: "var(--iris)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        {user.email?.[0].toUpperCase() ?? "U"}
                      </div>
                    )}
                    <span
                      style={{ fontSize: "0.9375rem", fontWeight: 500 }}
                      className="nav-user-name"
                    >
                      {user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        "Account"}
                    </span>
                  </button>

                  {dropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "0.5rem",
                        background: "var(--surface)",
                        border: "1px solid var(--ink-30)",
                        borderRadius: 0,
                        padding: "0.5rem",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        zIndex: 100,
                      }}
                    >
                      <div
                        style={{
                          padding: "0.5rem",
                          borderBottom: "1px solid var(--ink-06)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--ink-55)",
                          }}
                        >
                          Logged in as
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.email}
                        </div>
                        {role === "employer" && (
                          <div style={{ marginTop: "0.25rem", color: "var(--iris)", fontSize: "0.8125rem", fontWeight: 600 }}>
                            Employer account
                          </div>
                        )}
                      </div>
                      {role === "employer" && (
                        <>
                          <Link
                            href="/employer"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            Employer workspace
                          </Link>
                        </>
                      )}
                      {role === "candidate" && (
                        <Link
                          href="/onboarding"
                          onClick={() => setDropdownOpen(false)}
                          style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                          className="dropdown-item"
                        >
                          My resume
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          signOut();
                        }}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderRadius: 0,
                          fontSize: "0.875rem",
                          color: "#bc4a2a",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/login" style={{ marginRight: "0.5rem" }}>
                    SIGN_IN
                  </Link>
                  <Link href="/onboarding" className="btn btn-primary !text-white">
                    GET_STARTED →
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname.startsWith(href) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
              {loading ? (
                <span
                  className="mono"
                  style={{ fontSize: "0.85rem", opacity: 0.5 }}
                >
                  Loading...
                </span>
              ) : user ? (
                <div style={{ position: "relative" }}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      background: "transparent",
                      border: "none",
                      color: "var(--ink)",
                      padding: 0,
                    }}
                  >
                    {user.user_metadata?.avatar_url ||
                      user.user_metadata?.picture ? (
                      <img
                        src={
                          user.user_metadata.avatar_url ||
                          user.user_metadata.picture
                        }
                        alt="Profile"
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          border: "1px solid var(--ink-12)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: "var(--iris-12)",
                          color: "var(--iris)",
                          display: "grid",
                          placeItems: "center",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        {user.email?.[0].toUpperCase() ?? "U"}
                      </div>
                    )}
                    <span
                      style={{ fontSize: "0.9375rem", fontWeight: 500 }}
                      className="nav-user-name"
                    >
                      {user.user_metadata?.full_name ||
                        user.user_metadata?.name ||
                        "Account"}
                    </span>
                  </button>

                  {dropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "0.5rem",
                        background: "var(--surface)",
                        border: "1px solid var(--ink-30)",
                        borderRadius: 0,
                        padding: "0.5rem",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        zIndex: 100,
                      }}
                    >
                      <div
                        style={{
                          padding: "0.5rem",
                          borderBottom: "1px solid var(--ink-06)",
                          marginBottom: "0.25rem",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8125rem",
                            fontWeight: 600,
                            color: "var(--ink-55)",
                          }}
                        >
                          Logged in as
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--ink)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {user.email}
                        </div>
                        {role === "employer" && (
                          <div style={{ marginTop: "0.25rem", color: "var(--iris)", fontSize: "0.8125rem", fontWeight: 600 }}>
                            Employer account
                          </div>
                        )}
                      </div>
                      {role === "employer" && (
                        <>
                          <Link
                            href="/employer"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            Employer workspace
                          </Link>
                        </>
                      )}
                      {role === "candidate" && (
                        <Link
                          href="/onboarding"
                          onClick={() => setDropdownOpen(false)}
                          style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                          className="dropdown-item"
                        >
                          My resume
                        </Link>
                      )}
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          signOut();
                        }}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderRadius: 0,
                          fontSize: "0.875rem",
                          color: "#bc4a2a",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          width: "100%",
                        }}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link href="/login" className="btn btn-ghost">
                    Sign in
                  </Link>
                </>
              )}
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
