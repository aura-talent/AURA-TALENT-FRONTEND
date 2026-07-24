"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  fetchCandidateNotifications,
  type CandidateNotification,
} from "@/lib/notificationHelpers";


const APP_LINKS = [
  { href: "/dashboard", label: "DASHBOARD" },
  { href: "/profile", label: "PROFILE" },
  { href: "/tracker", label: "JOB_TRACKER" },
  { href: "/evaluate", label: "EVALUATE" },
  { href: "/worth", label: "YOUR_WORTH" },
  { href: "/insights", label: "INSIGHTS" },
  { href: "/jobs", label: "FIND_JOBS" },
  { href: "/bounties", label: "BOUNTIES" },
  { href: "/scan", label: "SCAN_JOBS" },
  { href: "/animal", label: "WORK_ANIMAL" },
  { href: "/mock-interview", label: "MOCK_INTERVIEW" },
  { href: "/templates", label: "COMMS_ASSISTANT" },
];

const EMPLOYER_LINKS = [
  { href: '/employer', label: 'OVERVIEW' },
  { href: '/employer/candidates', label: 'CANDIDATES' },
  { href: '/employer/jobs', label: 'JOBS' },
  { href: '/employer/bounties', label: 'BOUNTIES' },
  { href: '/employer/interviews', label: 'INTERVIEWS' },
  { href: '/employer/templates', label: 'TEMPLATES' },
];

export default function Nav() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const onEmployer = pathname.startsWith("/employer");
  const { user, loading, role, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<CandidateNotification[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchCandidateNotifications(user.id)
      .then((data) => {
        if (!cancelled) setNotifications(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // animate the sheet back up before unmounting
  function closeMenu() {
    setClosing(true);
    window.setTimeout(() => {
      setMenuOpen(false);
      setClosing(false);
    }, 450);
  }

  const isEmployerMode = role === "employer";
  const links = isEmployerMode ? EMPLOYER_LINKS : APP_LINKS;
  const currentIdx = links.findIndex((l) => pathname.startsWith(l.href));

  // close both menus whenever the route changes
  useEffect(() => {
    setMenuOpen(false);
    setDropdownOpen(false);
    setNotifOpen(false);
  }, [pathname]);


  // lock scroll + close on Escape while the fullscreen menu is open.
  // Pad by the scrollbar width so removing the scrollbar doesn't shift
  // the page sideways (no permanent gutter reserved).
  useEffect(() => {
    if (!menuOpen) return;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // the career map is a fullscreen immersive space with its own themed bar
  if (pathname.startsWith("/career-map")) return null;

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
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {/* Notification Bell Dropdown Button */}
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(!notifOpen);
                        setDropdownOpen(false);
                      }}
                      style={{
                        position: "relative",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.35rem",
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label="Notifications"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                      {notifications.length > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            right: "3px",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "var(--iris)",
                            boxShadow: "0 0 8px var(--iris)",
                          }}
                        />
                      )}
                    </button>

                    {notifOpen && (
                      <div
                        style={{
                          position: "absolute",
                          right: "-40px",
                          top: "100%",
                          marginTop: "0.5rem",
                          background: "var(--surface)",
                          border: "1px solid var(--ink-30)",
                          borderRadius: "10px",
                          width: "310px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                          zIndex: 100,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--ink-10)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>Notifications</span>
                          <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-50)" }}>{notifications.length} updates</span>
                        </div>

                        <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.82rem", color: "var(--ink-55)" }}>
                              No new notifications
                            </div>
                          ) : (
                            notifications.slice(0, 4).map((n) => (
                              <Link
                                key={n.id}
                                href={n.link}
                                onClick={() => setNotifOpen(false)}
                                style={{
                                  padding: "0.75rem 1rem",
                                  borderBottom: "1px solid var(--ink-06)",
                                  textDecoration: "none",
                                  color: "inherit",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.2rem",
                                  transition: "background 0.15s ease",
                                }}
                                className="dropdown-item"
                              >
                                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>
                                  {n.title}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--ink-65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {n.message}
                                </div>
                                <span style={{ fontSize: "0.68rem", color: "var(--ink-40)", marginTop: "0.1rem" }}>
                                  {n.timestamp}
                                </span>
                              </Link>
                            ))
                          )}
                        </div>

                        <div style={{ borderTop: "1px solid var(--ink-10)", padding: "0.5rem", textAlign: "center", background: "var(--ink-02)" }}>
                          <Link
                            href="/notifications"
                            onClick={() => setNotifOpen(false)}
                            style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--iris)", textDecoration: "none", display: "block", padding: "0.3rem" }}
                          >
                            View all notifications →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Menu Dropdown */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => {
                        setDropdownOpen(!dropdownOpen);
                        setNotifOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "transparent",
                        border: "none",
                        color: "var(--ink)",
                        padding: 0,
                        flexShrink: 0,
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
                      style={{ fontSize: "0.9375rem", fontWeight: 500, whiteSpace: "nowrap" }}
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
                        <>
                          <Link
                            href="/my-resume"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            My resume
                          </Link>
                          <Link
                            href="/dashboard?tour=1"
                            onClick={() => setDropdownOpen(false)}
                            style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                            className="dropdown-item"
                          >
                            Take the tour
                          </Link>
                        </>
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
              </div>
            ) : (


                <>
                  <Link href="/login?mode=signin" style={{ marginRight: "0.5rem" }}>
                    SIGN_IN
                  </Link>
                  <Link href="/login?mode=signup" className="btn btn-primary !text-white">
                    GET_STARTED →
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <button
                className="nav-index-toggle"
                onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
                aria-expanded={menuOpen}
                aria-label="Open navigation index"
              >
                <span className="nav-index-current">
                  {currentIdx >= 0
                    ? `${String(currentIdx + 1).padStart(2, "0")} / ${links[currentIdx].label}`
                    : "INDEX"}
                </span>
                <span
                  className={menuOpen ? "nav-index-caret open" : "nav-index-caret"}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
              {menuOpen && mounted &&
                createPortal(
                  <div
                    className={closing ? "nav-menu-overlay closing" : "nav-menu-overlay"}
                    role="dialog"
                    aria-modal="true"
                  >
                    <span className="nav-menu-label nav-menu-tl">
                      AURA_TALENT
                      <br />
                      {isEmployerMode ? "EMPLOYER_INDEX" : "WORKSPACE_INDEX"}
                    </span>
                    <span className="nav-menu-label nav-menu-br">
                      {currentIdx >= 0 ? `// ${links[currentIdx].label}` : "// MENU"}
                      <br />
                      SELECT_DESTINATION
                    </span>
                    <button
                      className="nav-menu-close"
                      onClick={closeMenu}
                      aria-label="Close menu"
                    >
                      ×
                    </button>
                    {user && (
                      <span className="nav-menu-foot">LOGGED_IN // {user.email}</span>
                    )}
                    <div className="nav-menu-inner">
                      <nav className="nav-menu-links">
                        {links.map((l, i) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            className="nav-menu-link"
                            aria-current={pathname.startsWith(l.href) ? "page" : undefined}
                            onClick={() => setMenuOpen(false)}
                            style={{ "--i": i } as CSSProperties}
                          >
                            <span className="nav-menu-num">{String(i + 1).padStart(2, "0")}</span>
                            <span className="nav-menu-text">{l.label}</span>
                          </Link>
                        ))}
                      </nav>
                    </div>
                  </div>,
                  document.body
                )}
              {loading ? (
                <span
                  className="mono"
                  style={{ fontSize: "0.85rem", opacity: 0.5 }}
                >
                  Loading...
                </span>
              ) : user ? (
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                  {/* Notification Bell Dropdown Button */}
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(!notifOpen);
                        setDropdownOpen(false);
                      }}
                      style={{
                        position: "relative",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: "0.35rem",
                        color: "var(--ink)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      aria-label="Notifications"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                      </svg>
                      {notifications.length > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: "3px",
                            right: "3px",
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: "var(--iris)",
                            boxShadow: "0 0 8px var(--iris)",
                          }}
                        />
                      )}
                    </button>

                    {notifOpen && (
                      <div
                        style={{
                          position: "absolute",
                          right: "-40px",
                          top: "100%",
                          marginTop: "0.5rem",
                          background: "var(--surface)",
                          border: "1px solid var(--ink-30)",
                          borderRadius: "10px",
                          width: "310px",
                          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
                          zIndex: 100,
                          overflow: "hidden",
                        }}
                      >
                        <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--ink-10)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--ink)" }}>Notifications</span>
                          <span className="mono" style={{ fontSize: "0.7rem", color: "var(--ink-50)" }}>{notifications.length} updates</span>
                        </div>

                        <div style={{ maxHeight: "280px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                          {notifications.length === 0 ? (
                            <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.82rem", color: "var(--ink-55)" }}>
                              No new notifications
                            </div>
                          ) : (
                            notifications.slice(0, 4).map((n) => (
                              <Link
                                key={n.id}
                                href={n.link}
                                onClick={() => setNotifOpen(false)}
                                style={{
                                  padding: "0.75rem 1rem",
                                  borderBottom: "1px solid var(--ink-06)",
                                  textDecoration: "none",
                                  color: "inherit",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.2rem",
                                  transition: "background 0.15s ease",
                                }}
                                className="dropdown-item"
                              >
                                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--ink)" }}>
                                  {n.title}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "var(--ink-65)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {n.message}
                                </div>
                                <span style={{ fontSize: "0.68rem", color: "var(--ink-40)", marginTop: "0.1rem" }}>
                                  {n.timestamp}
                                </span>
                              </Link>
                            ))
                          )}
                        </div>

                        <div style={{ borderTop: "1px solid var(--ink-10)", padding: "0.5rem", textAlign: "center", background: "var(--ink-02)" }}>
                          <Link
                            href="/notifications"
                            onClick={() => setNotifOpen(false)}
                            style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--iris)", textDecoration: "none", display: "block", padding: "0.3rem" }}
                          >
                            View all notifications →
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Profile Dropdown */}
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => {
                        setDropdownOpen(!dropdownOpen);
                        setNotifOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        background: "transparent",
                        border: "none",
                        color: "var(--ink)",
                        padding: 0,
                        flexShrink: 0,
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
                        style={{ fontSize: "0.9375rem", fontWeight: 500, whiteSpace: "nowrap" }}
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
                          <>
                            <Link
                              href="/my-resume"
                              onClick={() => setDropdownOpen(false)}
                              style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                              className="dropdown-item"
                            >
                              My resume
                            </Link>
                            <Link
                              href="/dashboard?tour=1"
                              onClick={() => setDropdownOpen(false)}
                              style={{ padding: "0.5rem", borderRadius: 0, fontSize: "0.875rem", color: "var(--ink-72)" }}
                              className="dropdown-item"
                            >
                              Take the tour
                            </Link>
                          </>
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
                </div>
              ) : (

                <>
                  <Link href="/login?mode=signin" className="btn btn-ghost">
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
