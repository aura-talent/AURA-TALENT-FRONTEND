"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ReportView from "@/components/ReportView";

export default function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getReport(Number(id))
      .then((r) => setMarkdown(r.report_markdown))
      .catch(() => setError("Report not found."));
  }, [id]);

  return (
    <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
      <div className="page-head">
        <Link href="/dashboard" style={{ color: "var(--ink-55)", fontSize: "0.875rem", textDecoration: "none" }}>
          ← Back to pipeline
        </Link>
      </div>
      {error && <div className="notice notice-error">{error}</div>}
      {markdown && (
        <div className="panel">
          <ReportView markdown={markdown} />
        </div>
      )}
      {!markdown && !error && (
        <div className="panel" style={{ textAlign: "center", padding: "3rem" }}>
          <p style={{ color: "var(--ink-55)" }}>Loading report…</p>
        </div>
      )}
    </div>
  );
}
