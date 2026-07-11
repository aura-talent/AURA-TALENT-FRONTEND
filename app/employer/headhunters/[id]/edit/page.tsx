"use client";

import { use, useEffect, useState } from "react";
import HeadhunterEditor from "@/components/employer/headhunter-editor";
import { Loader } from "@/components/ui/loader";
import { employerApi, type EmployerHeadhunter } from "@/lib/employerApi";

export default function EditHeadhunterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [headhunter, setHeadhunter] = useState<EmployerHeadhunter | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getHeadhunter(id)
      .then((data) => {
        if (!cancelled) setHeadhunter(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Headhunter not found");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Headhunter not found</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!headhunter)
    return (
      <div className="employer-page">
        <Loader label="Loading headhunter…" />
      </div>
    );

  return <HeadhunterEditor mode="edit" initialHeadhunter={headhunter} />;
}
