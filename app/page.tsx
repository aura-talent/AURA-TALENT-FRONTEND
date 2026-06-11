import Link from "next/link";
import HeroDemo from "@/components/HeroDemo";
import Reveal from "@/components/Reveal";

const STEPS = [
  {
    num: "1",
    title: "Upload your resume once",
    body: "PDF, Word, or plain text — Aura turns it into a clean profile and keeps it as the single source of truth for every evaluation.",
  },
  {
    num: "2",
    title: "Paste any job link",
    body: "Aura scores your real fit across five dimensions, maps every requirement to your actual experience, and flags ghost postings before you waste an evening.",
  },
  {
    num: "3",
    title: "Decide with evidence",
    body: "A full report: your gaps and how to close them, salary context, resume edits, an interview plan. Below 3.5? Aura tells you to skip it.",
  },
];

const BLOCKS = [
  { letter: "A", title: "Role summary", body: "What this job actually is — archetype, seniority, remote policy, one-line truth." },
  { letter: "B", title: "Resume match", body: "Every requirement mapped to evidence in your resume, gaps named with a fix for each." },
  { letter: "C", title: "Level strategy", body: "Their level vs. yours, and how to present senior without overstating anything." },
  { letter: "D", title: "Compensation", body: "What the posting says against what the market pays, stated plainly when data is thin." },
  { letter: "E", title: "Resume edits", body: "The five changes that most move your match for this specific job." },
  { letter: "F", title: "Interview plan", body: "Your stories mapped to their requirements, plus the awkward questions and good answers." },
  { letter: "G", title: "Posting legitimacy", body: "Freshness, specificity, reposting patterns — is this opening real or a pipeline ad?" },
];

export default function Landing() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <h1>Know which jobs deserve you.</h1>
            <p className="hero-sub">
              Aura reads a job post the way a sharp recruiter would — scores
              your real fit, shows what to fix in your resume, and tells you
              when to walk away.
            </p>
            <div className="hero-ctas">
              <Link href="/onboarding" className="btn btn-primary">
                Evaluate your first job
              </Link>
              <a href="#how" className="btn btn-ghost">
                See how it works
              </a>
            </div>
            <p className="hero-trust">
              Built on the open-source{" "}
              <a
                href="https://github.com/santifer/career-ops"
                target="_blank"
                rel="noopener noreferrer"
              >
                career-ops
              </a>{" "}
              engine — 740+ offers evaluated by its author before it landed
              him the job.
            </p>
          </div>
          <HeroDemo />
        </div>
      </section>

      <Reveal as="section" className="section" id="how">
        <div className="container">
          <h2 data-reveal>Three steps, then you decide.</h2>
          <p className="section-lede" data-reveal>
            No mass-apply tricks. Aura does the reading and the research, you
            keep the judgment.
          </p>
          <div className="steps">
            {STEPS.map((s) => (
              <div className="step" key={s.num} data-reveal>
                <div className="step-num">{s.num}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <section className="section" id="report">
        <div className="container dossier">
          <div className="dossier-intro">
            <h2>Seven blocks. The whole picture.</h2>
            <p className="section-lede">
              Every evaluation is a full dossier — the same structure a
              careful career coach would build, in about a minute.
            </p>
            <Link href="/evaluate" className="btn btn-ghost">
              Run one on a real job
            </Link>
          </div>
          <Reveal className="dossier-index" variant="row">
            {BLOCKS.map((b) => (
              <div className="dossier-row" key={b.letter} data-reveal>
                <span className="dossier-letter" aria-hidden="true">{b.letter}</span>
                <div>
                  <h3>{b.title}</h3>
                  <p>{b.body}</p>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      <Reveal as="section" className="section-tight">
        <div className="container">
          <div className="ethos" data-reveal>
            <div className="aura-glow" />
            <div className="grain" />
            <blockquote>
              Five sharp applications beat fifty blind ones.
            </blockquote>
            <p>
              Aura never auto-submits anything. It drafts, you decide. And when
              a job scores below 3.5, it says so plainly — your time is worth
              more than a maybe.
            </p>
          </div>
        </div>
      </Reveal>

      <section className="cta-band">
        <div className="aura-glow" />
        <div className="container" style={{ position: "relative" }}>
          <h2>The next application you send should be your best one.</h2>
          <p className="section-lede">
            Upload your resume and evaluate your first job in under two minutes.
          </p>
          <div className="hero-ctas">
            <Link href="/onboarding" className="btn btn-inverse">
              Get started — it&apos;s free
            </Link>
          </div>
          <p className="footnote">No mass applications. No auto-submit. Ever.</p>
        </div>
      </section>
    </>
  );
}
