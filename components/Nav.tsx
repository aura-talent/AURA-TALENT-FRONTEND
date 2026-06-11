"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const APP_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/evaluate", label: "Evaluate" },
  { href: "/scan", label: "Find jobs" },
  { href: "/compare", label: "Compare" },
];

export default function Nav() {
  const pathname = usePathname();
  const onLanding = pathname === "/";
  const onEmployer = pathname.startsWith("/employer");

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
              cx="16" cy="16" r="9" fill="none" stroke="url(#nav-aura)"
              strokeWidth="3.5" strokeLinecap="round"
              strokeDasharray="47.1" strokeDashoffset="7.5"
              transform="rotate(-90 16 16)"
            />
          </svg>
          Aura Talent
          {onEmployer && (
            <>
              <span className="nav-workspace mono">Employer workspace</span>
            </>
          )}
        </Link>
        <nav className="nav-links">
          {onEmployer ? (
            <></>
          ) : onLanding ? (
            <>
              <a href="#how">How it works</a>
              <a href="#report">The report</a>
              <Link href="/dashboard">Dashboard</Link>
              <Link href="/onboarding" className="btn btn-primary">
                Get started
              </Link>
            </>
          ) : (
            <>
              {APP_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={pathname.startsWith(href) ? "page" : undefined}
                >
                  {label}
                </Link>
              ))}
              <Link href="/onboarding" className="btn btn-ghost">
                My resume
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
