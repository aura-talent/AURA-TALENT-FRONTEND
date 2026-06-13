import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Aura Talent",
  description:
    "How Aura Talent and the Aura Talent Companion browser extension collect, use, and protect your data.",
};

const UPDATED = "June 13, 2026";
const CONTACT = "charleshor2004@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 text-foreground">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {UPDATED}</p>

      <div className="mt-10 space-y-8 text-[15px] leading-relaxed">
        <section className="space-y-3">
          <p>
            This policy explains how Aura Talent (&ldquo;Aura Talent,&rdquo;
            &ldquo;we,&rdquo; &ldquo;us&rdquo;) handles your data across the Aura
            Talent web application and the <strong>Aura Talent Companion</strong>{" "}
            browser extension. By using either, you agree to the practices
            described here.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Who we are</h2>
          <p>
            Aura Talent is a job-search assistant that evaluates job postings
            against your résumé, suggests tailored résumé edits, and drafts
            application materials such as cover letters.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data we collect</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Account information.</strong> When you sign in with Google
              or LinkedIn, our authentication provider (Supabase) gives us your
              name, email address, and profile picture.
            </li>
            <li>
              <strong>Résumé and profile content.</strong> The résumé you upload
              or paste, and any profile details you provide, so we can score your
              fit and tailor materials.
            </li>
            <li>
              <strong>Job postings you evaluate.</strong> The job-description text
              and URL you submit — including, when you use the browser extension,
              text read from the job page that is open in your active tab at the
              moment you click <em>Capture</em>.
            </li>
            <li>
              <strong>Generated results.</strong> Evaluations, scores, tailored
              résumé suggestions, cover letters, and your application history.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How the browser extension uses data</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              The extension reads the job text from your <strong>current tab only
              when you click the extension and press Capture</strong>. It does not
              read or monitor your browsing in the background.
            </li>
            <li>
              It reuses your existing Aura Talent login: it reads your session from
              an open Aura Talent tab so it can act as the same account. It never
              sees or stores your Google/LinkedIn password.
            </li>
            <li>
              Captured job text is sent to the Aura Talent backend to produce a
              match, tailored résumé, or cover letter. Requests are authenticated
              with your session and a server-side API key; the API key never lives
              in the extension or the browser.
            </li>
            <li>
              Your session token and settings are stored locally in the browser via
              the extension storage API. Signing out clears them.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How we use your data</h2>
          <ul className="list-disc space-y-2 pl-6">
            <li>To provide the core features: evaluating fit, tailoring résumés, and drafting application materials.</li>
            <li>To authenticate you and keep you signed in.</li>
            <li>To maintain your application history and improve the accuracy of your results.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal data, and we do not use
            it for advertising.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Service providers</h2>
          <p>We share data only with providers that help us operate the service:</p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Supabase</strong> — authentication and database storage.
            </li>
            <li>
              <strong>AI model providers</strong> — your résumé and the job text are
              sent to large-language-model providers (e.g. OpenAI) to generate
              evaluations and written materials. This data is processed to return
              your result and is not used by us to train models.
            </li>
            <li>
              <strong>Hosting</strong> — our application is hosted on Vercel and our
              backend on cloud infrastructure.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Data retention &amp; your rights</h2>
          <p>
            We keep your account, résumé, and history until you delete them or ask
            us to. You can request access to, correction of, or deletion of your
            data at any time by contacting us. Deleting your account removes your
            stored résumé and application history.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Security</h2>
          <p>
            Access to the backend is gated by authentication and a server-side API
            key. We take reasonable measures to protect your data, though no method
            of transmission or storage is completely secure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Changes to this policy</h2>
          <p>
            We may update this policy from time to time. Material changes will be
            reflected by the &ldquo;Last updated&rdquo; date above.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p>
            Questions about this policy or your data? Email us at{" "}
            <a className="text-primary underline" href={`mailto:${CONTACT}`}>
              {CONTACT}
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
