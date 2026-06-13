"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

const links = [
  { href: "/employer", label: "Overview", icon: "grid" },
  { href: "/employer/workforce", label: "Workforce plan", icon: "chart" },
  { href: "/employer/candidates", label: "Candidates", icon: "people" },
  { href: "/employer/interviews", label: "Interviews", icon: "spark" },
  { href: "/employer/jobs", label: "Job listings", icon: "briefcase" },
  { href: "/employer/profile", label: "Company profile", icon: "building" },
];

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
    building: (
      <>
        <path d="M3 21h18M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-5h4v5" />
      </>
    ),
  };
  return (
    <svg className="employer-icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
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
          {links.map((link) => {
            const active =
              link.href === "/employer"
                ? pathname === link.href
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={link.icon} />
                <span>{link.label}</span>
              </Link>
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
          <button
            onClick={() => signOut()}
            title="Sign out"
            style={{
              flexShrink: 0,
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
      </aside>
      <section className="employer-content">{children}</section>
    </div>
  );
}
