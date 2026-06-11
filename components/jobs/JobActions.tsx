"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "aura_job_applications";

export default function JobActions({
  jobId,
  mockInterviewEnabled,
}: {
  jobId: string;
  mockInterviewEnabled: boolean;
}) {
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    const applications = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as string[];
    queueMicrotask(() => setApplied(applications.includes(jobId)));
  }, [jobId]);

  function apply() {
    const applications = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as string[];
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([...new Set([...applications, jobId])]),
    );
    setApplied(true);
  }

  return (
    <div className="job-detail-actions">
      <button className="btn btn-primary" disabled={applied} onClick={apply}>
        {applied ? "Application submitted ✓" : "Apply for this role"}
      </button>
      {mockInterviewEnabled && (
        <Link className="btn btn-ghost" href={`/jobs/${jobId}/interview`}>
          {applied ? "Attempt mock interview" : "Preview mock interview"}
        </Link>
      )}
      <small>
        {applied
          ? "Northstar Labs can now review your profile and resume."
          : "Your Aura profile and latest resume will be included."}
      </small>
    </div>
  );
}
