import Link from "next/link";

export default function ApplicantsPage() {
  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Jobs · Action</p>
          <h1>Applicants</h1>
          <p>A unified view across every job&apos;s applicants is coming soon.</p>
        </div>
      </div>
      <div className="empty-state panel">
        <h3>Coming soon</h3>
        <p>
          For now, review applicants per role from{" "}
          <Link href="/employer/jobs">Job Listing</Link> → a job&apos;s details page.
        </p>
      </div>
    </div>
  );
}
