"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Breadcrumbs from "@/components/employer/Breadcrumbs";
import AuraChatPanel from "@/components/employer/chat/AuraChatPanel";

type NavLink = { href: string; label: string; icon?: string };
type NavModule = { label: string; icon?: string; items: NavLink[] };
type NavSection =
  | { id: string; label: string; icon: string; href: string }
  | { id: string; label: string; icon: string; modules: NavModule[] }
  | { id: string; label: string; icon: string; items: NavLink[] };

// EXACT original navigation structure with icons for every sub-item:
const NAV: NavSection[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid", href: "/employer" },
  {
    id: "jobs",
    label: "Jobs",
    icon: "briefcase",
    modules: [
      {
        label: "Planning",
        icon: "calendar",
        items: [
          { href: "/employer/jobs", label: "Job Listing", icon: "list" },
          { href: "/employer/workforce", label: "Workforce Plan", icon: "chart" },
        ],
      },
      {
        label: "Action",
        icon: "zap",
        items: [
          { href: "/employer/applicants", label: "Applicants", icon: "people" },
          { href: "/employer/offers", label: "Offers", icon: "bolt" },
        ],
      },
    ],
  },
  {
    id: "talent-pool",
    label: "Talent Pool",
    icon: "archive",
    items: [
      { href: "/employer/talent-pool", label: "Talent Pool", icon: "database" },
      { href: "/employer/bounties", label: "Bounties", icon: "trophy" },
    ],
  },
  { id: "headhunters", label: "Headhunters", icon: "scout", href: "/employer/headhunters" },
];

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/employer") return pathname === href;
  if (href === "/employer/talent-pool") {
    return pathname.startsWith("/employer/talent-pool") || pathname.startsWith("/employer/candidates");
  }
  return pathname.startsWith(href);
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() ?? "?";
  }
  return email?.[0]?.toUpperCase() ?? "?";
}

const ICON_PATHS: Record<string, React.ReactNode> = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
    </>
  ),
  archive: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3h8a2 2 0 0 1 2 2v0M8 10h8M10 14h4" />
    </>
  ),
  scout: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" style={{ fill: "currentColor" }} />
    </>
  ),
  building: (
    <>
      <path d="M3 21h18M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-5h4v5" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  zap: (
    <>
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </>
  ),
  list: (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="3" y1="12" x2="3.01" y2="12" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="3" y1="18" x2="3.01" y2="18" strokeWidth="2.5" strokeLinecap="round" />
    </>
  ),
  chart: (
    <>
      <path d="M3 3v18h18" />
      <path d="m19 9-5 5-4-4-3 3" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bolt: (
    <>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5H4a1 1 0 0 0-1 1 5 5 0 0 0 4 5M17 5h3a1 1 0 0 1 1 1 5 5 0 0 1-4 5" />
    </>
  ),
};

function NavIcon({ name, size = 18, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`nav-icon ${className}`}
    >
      {ICON_PATHS[name] ?? null}
    </svg>
  );
}

// Collapsible Module (e.g. Planning, Action)
function ModuleDropdown({ mod, pathname }: { mod: NavModule; pathname: string }) {
  const isModuleActive = mod.items.some((item) => isLinkActive(pathname, item.href));
  const [open, setOpen] = useState(true);

  return (
    <div className="nav-module">
      <button
        type="button"
        className={`nav-module-toggle${isModuleActive ? " is-active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
          {mod.icon && <NavIcon name={mod.icon} size={14} />}
          <span>{mod.label}</span>
        </span>
        <svg
          className={`nav-chevron${open ? " is-open" : ""}`}
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div className={`nav-collapse-wrap${open ? " is-open" : ""}`}>
        <div className="nav-module-links">
          {mod.items.map((item) => {
            const active = isLinkActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link-sub${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {active && <span className="nav-active-pill" aria-hidden="true" />}
                {item.icon && <NavIcon name={item.icon} size={15} />}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function EmployerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading, role, signOut } = useAuth();

  if (loading) {
    return (
      <div className="container" style={{ minHeight: "80vh", display: "grid", placeItems: "center" }}>
        <div className="thinking">
          <div className="thinking-orb" />
          <p className="thinking-status">Checking workspace access…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container" style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div className="panel" style={{ maxWidth: "480px", textAlign: "center", padding: "3rem 2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🔒</div>
          <h2 style={{ marginBottom: "0.75rem" }}>Sign in required</h2>
          <p style={{ color: "var(--ink-72)", marginBottom: "2rem", fontSize: "0.9375rem" }}>
            You need to be signed in to access the Employer Workspace.
          </p>
          <Link href="/login?redirect=/employer" className="btn btn-primary">Sign in</Link>
        </div>
      </div>
    );
  }

  if (role !== "employer") return null;

  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "User";
  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
  const initials = getInitials(
    user.user_metadata?.full_name ?? user.user_metadata?.name,
    user.email,
  );

  return (
    <div className="employer-shell">
      <aside className="employer-sidebar nav-sidebar">
        {/* Workspace Brand Badge */}
        <div className="nav-brand">
          <div className="nav-brand-badge">{initials[0]}</div>
          <div className="nav-brand-text">
            <strong>Employer Workspace</strong>
            <span>Talent team</span>
          </div>
        </div>

        <div className="nav-divider" />

        {/* Navigation Menu */}
        <nav className="nav-menu" aria-label="Employer navigation">
          {NAV.map((section) => {
            // Direct Top Link (Dashboard, Headhunters)
            if ("href" in section) {
              const active = isLinkActive(pathname, section.href);
              return (
                <div key={section.id} className="nav-section-direct">
                  <Link
                    href={section.href}
                    className={`nav-link-main${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {active && <span className="nav-active-pill" aria-hidden="true" />}
                    <NavIcon name={section.icon} size={18} />
                    <span>{section.label}</span>
                  </Link>
                </div>
              );
            }

            // Grouped Section (Jobs, Talent Pool)
            return (
              <div key={section.id} className="nav-section-group">
                <div className="nav-section-header">
                  <NavIcon name={section.icon} size={15} />
                  <span>{section.label}</span>
                </div>

                {"modules" in section ? (
                  <div className="nav-section-modules nav-dotted-flow">
                    {section.modules.map((mod) => (
                      <ModuleDropdown key={mod.label} mod={mod} pathname={pathname} />
                    ))}
                  </div>
                ) : (
                  <div className="nav-section-static-items">
                    {section.items.map((item) => {
                      const active = isLinkActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`nav-link-sub${active ? " is-active" : ""}`}
                          aria-current={active ? "page" : undefined}
                        >
                          {active && <span className="nav-active-pill" aria-hidden="true" />}
                          {item.icon && <NavIcon name={item.icon} size={15} />}
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="nav-footer">
          <div className="nav-divider" style={{ marginBottom: "0.75rem" }} />
          <div className="nav-user-card">
            <div className="nav-user-avatar">
              {avatarUrl ? <img src={avatarUrl} alt={displayName} /> : <span>{initials}</span>}
            </div>
            <div className="nav-user-info">
              <strong>{displayName}</strong>
              <span>Employer</span>
            </div>
            <div className="nav-user-actions">
              <Link
                href="/employer/profile"
                title="Company profile"
                className={`nav-icon-btn${pathname.startsWith("/employer/profile") ? " is-active" : ""}`}
                aria-current={pathname.startsWith("/employer/profile") ? "page" : undefined}
              >
                <NavIcon name="building" size={15} />
              </Link>
              <button onClick={() => signOut()} title="Sign out" className="nav-icon-btn nav-signout-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <section className="employer-content">
        <Breadcrumbs />
        {children}
      </section>

      <AuraChatPanel />
    </div>
  );
}