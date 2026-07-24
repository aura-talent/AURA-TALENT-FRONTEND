"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Human labels for the known static route segments. Anything not here is
// treated as a dynamic id and resolved against the entity-label store below.
const SEGMENT_LABELS: Record<string, string> = {
  employer: "Overview",
  jobs: "Job listings",
  workforce: "Workforce plan",
  candidates: "Candidates",
  "talent-pool": "Talent pool",
  headhunters: "Headhunters",
  interviews: "Interviews",
  templates: "Communication templates",
  profile: "Company profile",
  "pipeline-settings": "Pipeline phases",
  stages: "Application stages",
  offers: "Offer console",
  applicants: "Applicants",
  resume: "Resume",
  interview: "Interview",
  edit: "Edit",
  new: "New",
  customize: "Customize",
};

// ── Entity-label store ──────────────────────────────────────────────────────
// Pages that load a named entity (a job, a candidate) call setBreadcrumbLabel
// so the dynamic id segment shows the entity's name instead of a raw id. The
// store is a module-level map + a window event the breadcrumb subscribes to.
const entityLabels = new Map<string, string>();
const EVENT = "aura:breadcrumb-label";

export function setBreadcrumbLabel(id: string, label: string) {
  if (!id || !label || entityLabels.get(id) === label) return;
  entityLabels.set(id, label);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function isDynamicId(segment: string): boolean {
  return !SEGMENT_LABELS[segment];
}

function humanize(segment: string): string {
  return segment.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Breadcrumbs() {
  const pathname = usePathname();
  const [, force] = useState(0);

  useEffect(() => {
    const handler = () => force((n) => n + 1);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  // Only meaningful inside the employer workspace and below the root page.
  if (segments[0] !== "employer" || segments.length < 2) return null;

  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    let label = SEGMENT_LABELS[segment];
    if (!label) {
      label = isDynamicId(segment)
        ? entityLabels.get(segment) ?? "Details"
        : humanize(segment);
    }
    return { href, label };
  });

  return (
    <nav className="employer-breadcrumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        return (
          <span key={crumb.href} className="employer-breadcrumb-item">
            {isLast ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link href={crumb.href}>{crumb.label}</Link>
            )}
            {!isLast && <span className="employer-breadcrumb-sep">/</span>}
          </span>
        );
      })}
    </nav>
  );
}
