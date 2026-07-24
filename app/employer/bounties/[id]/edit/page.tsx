"use client";

import { use, useEffect, useState } from "react";
import BountyEditor from "@/components/employer/bounty-editor";
import { Loader } from "@/components/ui/loader";
import { bountyApi, type Bounty } from "@/lib/bountyApi";

export default function EditBountyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    bountyApi
      .getById(id)
      .then((data) => {
        if (cancelled) return;
        if (data) setBounty(data);
        else setError("Bounty not found");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Bounty not found");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error)
    return (
      <div className="employer-page">
        <div className="empty-state panel">
          <h3>Bounty not found</h3>
          <p>{error}</p>
        </div>
      </div>
    );
  if (!bounty)
    return (
      <div className="employer-page">
        <Loader label="Loading bounty…" />
      </div>
    );

  return <BountyEditor mode="edit" initialBounty={bounty} />;
}
