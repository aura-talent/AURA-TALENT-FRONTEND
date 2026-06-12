import Link from "next/link";
import { notFound } from "next/navigation";
import PdfReader from "@/components/pdf-reader";
import { candidates, jobs } from "../../../data";
import styles from "./Resume.module.css";

export default async function CandidateResumePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate || !candidate.applied) notFound();

  const job = jobs.find((item) => item.id === candidate.jobId);
  const resumeUrl = "/employer/candidates/sample-resume.pdf";

  return (
    <div className="employer-page">
      <Link href={`/employer/candidates/${candidate.id}`} className="back-link">
        ← Candidate evaluation
      </Link>

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Submitted application</p>
          <h1>{candidate.name}&apos;s resume</h1>
          <p>
            Resume submitted for {job?.title ?? candidate.role} and analyzed by
            Aura against the role requirements.
          </p>
        </div>
        <a className="btn btn-ghost" href={resumeUrl} download>
          Download PDF
        </a>
      </div>

      <div className={styles.layout}>
        <main className={`panel ${styles.viewerPanel}`}>
          <PdfReader
            file={resumeUrl}
            title={`${candidate.name}'s submitted resume`}
          />
        </main>

        <aside>
          <section className="panel employer-section">
            <p className="eyebrow">ATS analysis</p>
            <div className={styles.matchScore}>
              <strong>{candidate.metrics.match}%</strong>
              <span>Role match</span>
            </div>
            <p className={styles.note}>
              Aura found contextual evidence for the employer-prioritized
              skills, not only exact keyword repetition.
            </p>
          </section>
          <section className="panel employer-section">
            <h3>Matched evidence</h3>
            <div className={styles.matchedEvidence}>
              {candidate.matchedKeywords.map((keyword, index) => (
                <span key={keyword}>
                  <i>{index < 3 ? "Priority" : "Matched"}</i>
                  {keyword}
                  <b>✓</b>
                </span>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
