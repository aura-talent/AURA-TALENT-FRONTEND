"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/employer", label: "Overview", icon: "grid" },
  { href: "/employer/candidates", label: "Candidates", icon: "people", count: 18 },
  { href: "/employer/interviews", label: "Interviews", icon: "spark" },
  { href: "/employer/jobs", label: "Job listings", icon: "briefcase" },
  { href: "/employer/workforce", label: "Workforce plan", icon: "chart" },
  { href: "/employer/profile", label: "Company profile", icon: "building" },
];

function Icon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    spark: <><path d="m12 3-1.4 3.6L7 8l3.6 1.4L12 13l1.4-3.6L17 8l-3.6-1.4L12 3Z"/><path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8L19 14Z"/><path d="M5 14v7M2 17.5h6"/></>,
    briefcase: <><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/></>,
    chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
    building: <><path d="M3 21h18M6 21V4h12v17M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-5h4v5"/></>,
  };
  return <svg className="employer-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function EmployerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="employer-shell">
      <aside className="employer-sidebar">
        <div className="employer-company">
          <div className="employer-company-mark">N</div>
          <div>
            <strong>Northstar Labs</strong>
            <span>Talent team</span>
          </div>
        </div>
        <nav className="employer-menu" aria-label="Employer navigation">
          {links.map((link) => {
            const active = link.href === "/employer" ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}>
                <Icon name={link.icon} />
                <span>{link.label}</span>
                {link.count && <span className="employer-menu-count">{link.count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="employer-sidebar-foot">
          <div className="employer-avatar">AM</div>
          <div><strong>Aisha Malik</strong><span>Hiring manager</span></div>
        </div>
      </aside>
      <section className="employer-content">{children}</section>
    </div>
  );
}
