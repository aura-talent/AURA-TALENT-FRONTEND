import Link from "next/link";
import Hero from "@/components/Hero";
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
    <div className="landing">
      <Hero />

      <div className="landing-sheet">
        <Reveal as="section" className="section" id="how">
          <div className="container">
            <div className="section-kicker" data-reveal>
              (02) // PROCESS
            </div>
            <h2 data-reveal>Three steps, then you decide.</h2>
            <p className="section-lede" data-reveal>
              No mass-apply tricks. Aura does the reading and the research, you
              keep the judgment.
            </p>
            <span className="rule" data-reveal-line />
            <div className="steps">
              {STEPS.map((s) => (
                <div className="step" key={s.num} data-reveal>
                  <div className="step-num">[0{s.num}]</div>
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
              <div className="section-kicker">(03) // THE_REPORT</div>
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
              <span className="rule" data-reveal-line />
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
              <div className="grain" />
              <span className="ethos-label ethos-label-tl" aria-hidden="true">
                (04) // ETHOS
              </span>
              <span className="ethos-label ethos-label-br" aria-hidden="true">
                JUDGMENT &gt; VOLUME
              </span>
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

        <Reveal as="section" className="cta-band">
          <span className="cta-label cta-label-tl" aria-hidden="true">
            (DIAGRAM 02)
            <br />
            FINAL_CALL
          </span>
          <span className="cta-label cta-label-br" aria-hidden="true">
            SYSTEM_READY
            <br />
            AWAITING_INPUT
          </span>
          <div className="container" style={{ position: "relative" }}>
            <h2 data-reveal>
              The next application you send should be your best one.
            </h2>
            <p className="section-lede" data-reveal>
              Upload your resume and evaluate your first job in under two minutes.
            </p>
            <div className="hero-ctas" data-reveal>
              <Link href="/onboarding" className="btn btn-inverse">
                Get started — it&apos;s free
              </Link>
            </div>
            <p className="footnote" data-reveal>
              NO_MASS_APPLICATIONS // NO_AUTO_SUBMIT // EVER
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
