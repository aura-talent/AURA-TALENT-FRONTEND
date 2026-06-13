"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import gsap from "gsap";
import { api, type ResumeData } from "@/lib/api";
import ReportView from "@/components/ReportView";
import { useAuth } from "@/components/AuthProvider";

export default function MyResume() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();

  const [resume, setResume] = useState<ResumeData | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/my-resume");
      return;
    }
    api
      .getResume()
      .then(setResume)
      .catch(() => setResume(null))
      .finally(() => setChecked(true));
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!checked) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.6 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 }).from(
        q(".my-resume-body"),
        { y: 26, autoAlpha: 0, duration: 0.7 },
        "-=0.3"
      );
    });
    return () => mm.revert();
  }, [checked]);

  if (authLoading || !user || !checked) {
    return (
      <div className="app-sheet">
        <div className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center" }}>
          <div className="scan-status">
            <span className="scan-spinner" />
            LOADING_RESUME // STAND_BY
          </div>
        </div>
      </div>
    );
  }

  const headline =
    (resume?.profile?.headline as string | undefined) ||
    (Array.isArray(resume?.profile?.target_archetypes)
      ? (resume!.profile!.target_archetypes as string[])[0]
      : undefined);

  return (
    <div className="app-sheet" ref={root}>
      <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
        <div className="page-head my-resume-head">
          <div>
            <div className="page-kicker">(01) // YOUR_RESUME</div>
            <h1>Your résumé</h1>
            <p>
              {headline
                ? `On file as “${headline}”. This is the single source of truth for every evaluation.`
                : "This is the single source of truth Aura matches every job against."}
            </p>
          </div>
          <Link href="/onboarding" className="btn btn-primary">
            Upload new résumé →
          </Link>
        </div>

        <div className="my-resume-body">
          {resume ? (
            <div className="panel">
              <ReportView markdown={resume.markdown} />
            </div>
          ) : (
            <div className="panel" style={{ textAlign: "center", padding: "3.5rem 1.5rem" }}>
              <h3 style={{ marginBottom: "0.6rem" }}>No résumé on file yet</h3>
              <p style={{ color: "var(--ink-72)", marginBottom: "1.5rem" }}>
                Upload your résumé once and Aura scores every job against it.
              </p>
              <Link href="/onboarding" className="btn btn-primary">
                Upload your résumé
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
