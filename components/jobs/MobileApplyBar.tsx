"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "aura_job_applications";

export default function MobileApplyBar({
  jobId,
  jobTitle,
  companyName,
  fit,
  mockInterviewEnabled,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  fit: number;
  mockInterviewEnabled: boolean;
}) {
  const [applied, setApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    api
      .listApplications()
      .then((applications) => {
        if (!active) return;
        setApplied(
          applications.some(
            (application) =>
              application.company === companyName && application.role === jobTitle,
          ),
        );
      })
      .catch(() => {
        const applications = JSON.parse(
          localStorage.getItem(STORAGE_KEY) ?? "[]",
        ) as string[];
        if (active) setApplied(applications.includes(jobId));
      });

    return () => {
      active = false;
    };
  }, [companyName, jobId, jobTitle]);

  async function apply() {
    if (isSubmitting || applied) return;

    setIsSubmitting(true);
    try {
      await api.createManualApplication(companyName, jobTitle, "Applied");
      const applications = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]",
      ) as string[];
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([...new Set([...applications, jobId])]),
      );
      setApplied(true);
    } catch (error) {
      console.error("Failed to add application to tracker:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  const fitColor = fit >= 90 ? "#bfead8" : fit >= 80 ? "#c7b9ff" : "#ffd9c2";

  return (
    <div className="mobile-apply-bar" role="complementary" aria-label="Apply for this role">
      <div className="mobile-apply-bar-fit">
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span className="mobile-apply-bar-pct" style={{ color: fitColor }}>
              {fit}%
            </span>
            <span className="mobile-apply-bar-label">match</span>
          </div>
          <span
            className="mono"
            style={{
              fontSize: "0.58rem",
              color: "rgba(250,250,248,0.45)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            AURA_SCORED
          </span>
        </div>
      </div>

      <div className="mobile-apply-bar-actions">
        {mockInterviewEnabled && (
          <Link
            href={`/jobs/${jobId}/interview`}
            className="btn btn-ghost mobile-apply-btn-secondary"
          >
            Mock interview
          </Link>
        )}
        <button
          className="btn btn-primary mobile-apply-btn-primary"
          disabled={applied || isSubmitting}
          onClick={apply}
          style={{
            background: applied
              ? "rgba(191, 234, 216, 0.15)"
              : "linear-gradient(135deg, #c7b9ff 0%, #8f7dff 50%, #6852ed 100%)",
            color: applied ? "#bfead8" : "#0b0e1c",
            border: applied ? "1px solid rgba(191, 234, 216, 0.4)" : "none",
            fontWeight: 800,
            boxShadow: applied
              ? "0 0 16px rgba(191, 234, 216, 0.2)"
              : "0 4px 20px rgba(143, 125, 255, 0.4)",
          }}
        >
          {applied ? "Applied" : isSubmitting ? "Submitting..." : "Apply now"}
        </button>
      </div>
    </div>
  );
}
