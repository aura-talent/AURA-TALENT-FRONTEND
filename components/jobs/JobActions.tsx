"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

const STORAGE_KEY = "aura_job_applications";

export default function JobActions({
  jobId,
  jobTitle,
  companyName,
  mockInterviewEnabled,
}: {
  jobId: string;
  jobTitle: string;
  companyName: string;
  mockInterviewEnabled: boolean;
}) {
  const [applied, setApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

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
    setSubmitError("");
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
      setSubmitError("Could not submit your application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="job-detail-actions">
      <button
        className="btn btn-primary"
        disabled={applied || isSubmitting}
        onClick={apply}
      >
        {applied
          ? "Application submitted ✓"
          : isSubmitting
            ? "Submitting application..."
            : "Apply for this role"}
      </button>
      {mockInterviewEnabled && (
        <Link className="btn btn-ghost" href={`/jobs/${jobId}/interview`}>
          {applied ? "Attempt mock interview" : "Preview mock interview"}
        </Link>
      )}
      <small>
        {applied
          ? "Added to your job tracker as Applied."
          : "Your Aura profile and latest resume will be included."}
      </small>
      {submitError && <small role="alert">{submitError}</small>}
    </div>
  );
}
