import Link from "next/link";
import Dossier from "@/components/Dossier";
import Hero from "@/components/Hero";
import Reveal from "@/components/Reveal";
import WireProp from "@/components/WireProp";

const STEP_PROPS = ["document", "magnifier", "dial"] as const;

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
              {STEPS.map((s, i) => (
                <div className="step" key={s.num} data-reveal>
                  <div className="step-num">[0{s.num}]</div>
                  <WireProp kind={STEP_PROPS[i]} height={150} className="step-prop" />
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Dossier />

        <Reveal as="section" className="section-tight">
          <div className="container">
            <div className="ethos" data-reveal>
              <div className="grain" />
              <div className="ethos-prop" aria-hidden="true">
                <WireProp kind="scale" height={230} tone="porcelain" />
              </div>
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
