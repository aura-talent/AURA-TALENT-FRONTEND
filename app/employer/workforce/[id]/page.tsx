"use client";

import { use, useEffect, useState } from "react";
import JobPlanEditor from "@/components/employer/workforce-planner";
import { Loader } from "@/components/ui/loader";
import { defaultPipelinePhases } from "@/app/employer/data";
import {
  employerApi,
  type EmployerJob,
  type EmployerJobPlan,
  type PhaseDef,
} from "@/lib/employerApi";

export default function JobPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [job, setJob] = useState<EmployerJob | null>(null);
  const [plan, setPlan] = useState<EmployerJobPlan | null>(null);
  const [phases, setPhases] = useState<PhaseDef[]>(defaultPipelinePhases);
  const [ready, setReady] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      employerApi.getJob(id),
      employerApi.getJobPlan(id),
      employerApi.getProfile(),
    ]).then(([jobRes, planRes, profileRes]) => {
      if (cancelled) return;
      if (jobRes.status === "fulfilled") setJob(jobRes.value);
      else setNotFound(true);
      if (planRes.status === "fulfilled") setPlan(planRes.value);
      if (profileRes.status === "fulfilled" && profileRes.value.hiring_pipeline_phases?.length)
        setPhases(profileRes.value.hiring_pipeline_phases);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Job not found</h3>
        </div>
      </div>
    );
  if (!ready || !job)
    return (
      <div className="employer-page">
        <Loader label="Loading workforce plan…" />
      </div>
    );

  return <JobPlanEditor job={job} initialPlan={plan} phases={phases} />;
}
