"use client";

import { use, useEffect, useState } from "react";
import JobEditor from "@/components/employer/job-editor";
import { Loader } from "@/components/ui/loader";
import { employerApi, type EmployerJob } from "@/lib/employerApi";

export default function EditJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getJob(id)
      .then((data) => {
        if (!cancelled) setJob(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Job not found");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Job not found</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!job)
    return (
      <div className="employer-page">
        <Loader label="Loading job…" />
      </div>
    );

  return <JobEditor mode="edit" initialJob={job} />;
}
