"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import Breadcrumbs from "@/components/employer/Breadcrumbs";
import AuraChatPanel from "@/components/employer/chat/AuraChatPanel";

type NavLink = { href: string; label: string };
type NavModule = { label: string; items: NavLink[] };
type NavSection =
  | { id: string; label: string; icon: string; href: string }
  | { id: string; label: string; icon: string; modules: NavModule[] }
  | { id: string; label: string; icon: string; items: NavLink[] };

// 4 sections: Dashboard and Headhunters are direct links; Jobs groups its
// links into Planning/Action modules; Talent Pool groups Talent Pool +
// Bounties (bounties are another candidate-sourcing channel, folded in here
// rather than kept as its own top-level tab).
const NAV: NavSection[] = [
  { id: "dashboard", label: "Dashboard", icon: "grid", href: "/employer" },
  {
    id: "jobs",
    label: "Jobs",
    icon: "briefcase",
    modules: [
      {
        label: "Planning",
        items: [
          { href: "/employer/jobs", label: "Job Listing" },
          { href: "/employer/workforce", label: "Workforce Plan" },
        ],
      },
      {
        label: "Action",
        items: [
          { href: "/employer/applicants", label: "Applicants" },
          { href: "/employer/offers", label: "Offers" },
        ],
      },
    ],
  },
  {
    id: "talent-pool",
    label: "Talent Pool",
    icon: "archive",
    items: [
      { href: "/employer/talent-pool", label: "Talent Pool" },
      { href: "/employer/bounties", label: "Bounties" },
    ],
  },
  { id: "headhunters", label: "Headhunters", icon: "scout", href: "/employer/headhunters" },
];

function isLinkActive(pathname: string, href: string): boolean {
  return href === "/employer" ? pathname === href : pathname.startsWith(href);
}

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    people: (
      <>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z" />
        <path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8L19 14Z" />
        <path d="M5 14v7M2 17.5h6" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    archive: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3h8a2 2 0 0 1 2 2v0M8 10h8M10 14h4" />
      </>
    ),
    building: (
      <>
        <path d="M3 21h18M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-5h4v5" />
      </>
    ),
    scout: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1" style={{ fill: "currentColor" }} />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" stroke="none" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
      </>
    ),
    bolt: (
      <>
        <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
      </>
    ),
    trophy: (
      <>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 5H4a1 1 0 0 0-1 1 5 5 0 0 0 4 5M17 5h3a1 1 0 0 1 1 1 5 5 0 0 1-4 5" />
      </>
    ),
  };
  return (
    <svg className="employer-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

// A module is the actual dropdown (e.g. Jobs' "Planning" or "Action") — it
// expands inline within the sidebar (pushing what's below it down) via a
// CSS grid-rows transition, not JS height measurement. State lives in this
// component instance, which persists across client-side navigation (the
// sidebar doesn't remount between employer pages), so it stays open until
// its own header is clicked again — navigating to one of its links does not
// collapse it.
function ModuleDropdown({ mod, pathname }: { mod: NavModule; pathname: string }) {
  const [open, setOpen] = useState(false);
  const active = mod.items.some((item) => isLinkActive(pathname, item.href));

  return (
    <div className="employer-nav-module">
      <button
        type="button"
        className={`employer-nav-module-head${active ? " is-active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{mod.label}</span>
        <svg
          className={`employer-nav-chevron${open ? " open" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      <div className={`employer-nav-module-items${open ? " open" : ""}`}>
        <div className="employer-nav-module-items-inner">
          {mod.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="employer-nav-link"
              aria-current={isLinkActive(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0]?.toUpperCase() ?? "?";
  }
  return email?.[0]?.toUpperCase() ?? "?";
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
        <div className="panel" style={{ maxWidth: "480px", textAlign: "center", padding: "3rem 2rem", background: "var(--surface)", border: "1px solid var(--ink-06)", boxShadow: "var(--shadow-lift)" }}>
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

  if (role !== "employer") {
    return null; // Handled by RouteGuard
  }

  const displayName = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email ?? "User";
  const avatarUrl = user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null;
  const initials = getInitials(user.user_metadata?.full_name ?? user.user_metadata?.name, user.email);

  return (
    <div className="employer-shell">
      <aside className="employer-sidebar">
        <div className="employer-company">
          <div className="employer-company-mark" style={{ background: "linear-gradient(135deg, var(--iris), var(--peach))", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
            {initials[0]}
          </div>
          <div>
            <strong>Employer Workspace</strong>
            <span>Talent team</span>
          </div>
        </div>
        <nav className="employer-menu" aria-label="Employer navigation">
          {NAV.map((section) => {
            // A section with a single href IS the clickable item — no
            // separate static label needed above it (Dashboard, Headhunters).
            if ("href" in section) {
              const active = isLinkActive(pathname, section.href);
              return (
                <Link key={section.id} href={section.href} aria-current={active ? "page" : undefined}>
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </Link>
              );
            }
            // Every other section is just a static label + spacing grouping
            // its children — never itself clickable. "modules" render as
            // dropdowns (ModuleDropdown); a flat "items" list renders as
            // always-visible static links (nothing to collapse).
            return (
              <div key={section.id} className="employer-nav-section">
                <div className="employer-nav-section-label">
                  <Icon name={section.icon} />
                  <span>{section.label}</span>
                </div>
                {"modules" in section
                  ? section.modules.map((mod) => (
                      <ModuleDropdown key={mod.label} mod={mod} pathname={pathname} />
                    ))
                  : (
                    <div className="employer-nav-static-items">
                      {section.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="employer-nav-link"
                          aria-current={isLinkActive(pathname, item.href) ? "page" : undefined}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
              </div>
            );
          })}
        </nav>
        <div className="employer-sidebar-foot">
          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", flex: 1, minWidth: 0 }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--ink-06)", flexShrink: 0 }} />
            ) : (
              <div className="employer-avatar" style={{ flexShrink: 0 }}>{initials}</div>
            )}
            <div style={{ overflow: "hidden", flex: 1 }}>
              <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName}</strong>
              <span>Employer</span>
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.35rem", flexShrink: 0 }}>
            <Link
              href="/employer/profile"
              title="Company profile"
              aria-current={pathname.startsWith("/employer/profile") ? "page" : undefined}
              style={{
                background: "transparent",
                border: "1px solid var(--ink-12)",
                borderRadius: "var(--r-s)",
                padding: "0.35rem 0.5rem",
                color: "var(--ink-55)",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--iris-deep)"; e.currentTarget.style.borderColor = "var(--iris)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--ink-55)"; e.currentTarget.style.borderColor = "var(--ink-12)"; }}
            >
              <Icon name="building" />
            </Link>
            <button
              onClick={() => signOut()}
              title="Sign out"
              style={{
                background: "transparent",
                border: "1px solid var(--ink-12)",
                borderRadius: "var(--r-s)",
                padding: "0.35rem 0.5rem",
                cursor: "pointer",
                color: "var(--ink-55)",
                display: "flex",
                alignItems: "center",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#bc4a2a"; (e.currentTarget as HTMLButtonElement).style.borderColor = "#bc4a2a"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-55)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--ink-12)"; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </aside>
      <section className="employer-content">
        <Breadcrumbs />
        {children}
      </section>
      <AuraChatPanel />
    </div>
  );
}
