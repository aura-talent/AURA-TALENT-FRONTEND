'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useState } from "react";

const APP_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/evaluate', label: 'Evaluate' },
  { href: '/scan', label: 'Find jobs' },
  { href: '/compare', label: 'Compare' },
];

export default function Nav() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const { user, loading, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="nav">
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
          Aura Talent
        </Link>
        <nav className="nav-links">
          {onLanding ? (
            <>
              <a href="#how">How it works</a>
              <a href="#report">The report</a>
              <Link href="/dashboard">Dashboard</Link>
              {loading ? (
                <span className="mono" style={{ fontSize: "0.85rem", opacity: 0.5 }}>Loading...</span>
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
                    {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                      <img
                        src={user.user_metadata.avatar_url || user.user_metadata.picture}
                        alt="Profile"
                        style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--ink-12)" }}
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
                    <span style={{ fontSize: "0.9375rem", fontWeight: 500 }} className="nav-user-name">
                      {user.user_metadata?.full_name || user.user_metadata?.name || "Account"}
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
                        border: "1px solid var(--ink-06)",
                        borderRadius: "var(--r-m)",
                        boxShadow: "var(--shadow-card)",
                        padding: "0.5rem",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        zIndex: 100,
                      }}
                    >
                      <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-06)", marginBottom: "0.25rem" }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ink-55)" }}>Logged in as</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.email}
                        </div>
                      </div>
                      <Link
                        href="/onboarding"
                        onClick={() => setDropdownOpen(false)}
                        style={{ padding: "0.5rem", borderRadius: "var(--r-s)", fontSize: "0.875rem", color: "var(--ink-72)" }}
                        className="dropdown-item"
                      >
                        My resume
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          signOut();
                        }}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderRadius: "var(--r-s)",
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
                    Sign in
                  </Link>
                  <Link href="/onboarding" className="btn btn-primary !text-white">
                    Get started
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              {APP_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname.startsWith(href) ? 'page' : undefined}
                >
                  {label}
                </Link>
              ))}
              {loading ? (
                <span className="mono" style={{ fontSize: "0.85rem", opacity: 0.5 }}>Loading...</span>
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
                    {user.user_metadata?.avatar_url || user.user_metadata?.picture ? (
                      <img
                        src={user.user_metadata.avatar_url || user.user_metadata.picture}
                        alt="Profile"
                        style={{ width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--ink-12)" }}
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
                    <span style={{ fontSize: "0.9375rem", fontWeight: 500 }} className="nav-user-name">
                      {user.user_metadata?.full_name || user.user_metadata?.name || "Account"}
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
                        border: "1px solid var(--ink-06)",
                        borderRadius: "var(--r-m)",
                        boxShadow: "var(--shadow-card)",
                        padding: "0.5rem",
                        minWidth: "180px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        zIndex: 100,
                      }}
                    >
                      <div style={{ padding: "0.5rem", borderBottom: "1px solid var(--ink-06)", marginBottom: "0.25rem" }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--ink-55)" }}>Logged in as</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {user.email}
                        </div>
                      </div>
                      <Link
                        href="/onboarding"
                        onClick={() => setDropdownOpen(false)}
                        style={{ padding: "0.5rem", borderRadius: "var(--r-s)", fontSize: "0.875rem", color: "var(--ink-72)" }}
                        className="dropdown-item"
                      >
                        My resume
                      </Link>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          signOut();
                        }}
                        style={{
                          textAlign: "left",
                          padding: "0.5rem",
                          borderRadius: "var(--r-s)",
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
