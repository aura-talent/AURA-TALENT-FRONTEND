"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { api, type JobPosting } from "@/lib/api";
import Thinking from "@/components/Thinking";

function guessCountry(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return "";

    if (tz.includes("Kuala_Lumpur")) return "Malaysia";
    if (tz.includes("Singapore")) return "Singapore";
    if (tz.includes("London") || tz.includes("Europe/London") || tz.includes("GB")) return "United Kingdom";
    if (tz.includes("America/") || tz.includes("US/")) return "United States";
    if (tz.includes("Europe/Berlin")) return "Germany";
    if (tz.includes("Europe/Paris")) return "France";
    if (tz.includes("Asia/Tokyo")) return "Japan";
    if (tz.includes("Australia/")) return "Australia";
    if (tz.includes("Asia/Seoul")) return "South Korea";
    if (tz.includes("Asia/Hong_Kong")) return "Hong Kong";
    if (tz.includes("Asia/Shanghai") || tz.includes("Asia/Taipei")) return "Taiwan";
    if (tz.includes("Asia/Jakarta")) return "Indonesia";
    if (tz.includes("Asia/Manila")) return "Philippines";
    if (tz.includes("Asia/Bangkok")) return "Thailand";
    if (tz.includes("Asia/Ho_Chi_Minh")) return "Vietnam";
    if (tz.includes("Asia/Kolkata")) return "India";

    const parts = tz.split("/");
    if (parts.length > 1) {
      return parts[1].replace(/_/g, " ");
    }
  } catch (e) {
    // Ignore error
  }
  return "";
}

export default function ScanPage() {
  const root = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [keywords, setKeywords] = useState("");
  const [locationInput, setLocationInput] = useState(() => {
    if (typeof window === "undefined") return "";
    const saved = localStorage.getItem("aura_location_filter");
    if (saved !== null) return saved;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const guessed = guessCountry();
      return guessed ? `${guessed}, Remote` : "Remote";
    }
    return "";
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [scanErrors, setScanErrors] = useState<string[]>([]);
  const [jobs, setJobs] = useState<JobPosting[] | null>(null);

  useEffect(() => {
    // The initial value already covers "saved in localStorage" and "no
    // geolocation available" synchronously (see useState initializer above);
    // this effect only handles the async geolocation lookup.
    if (typeof window !== "undefined" && localStorage.getItem("aura_location_filter") !== null) {
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          if (res.ok) {
            const data = await res.json();
            const city = data.city || data.locality || data.principalSubdivision || "";
            if (city) {
              const val = `${city}, Remote`;
              setLocationInput(val);
              localStorage.setItem("aura_location_filter", val);
              return;
            }
          }
        } catch (e) {
          console.error("Geocoding lookup failed:", e);
        }
        const guessed = guessCountry();
        const fallback = guessed ? `${guessed}, Remote` : "Remote";
        setLocationInput(fallback);
      },
      (err) => {
        console.warn("Geolocation permission denied or failed:", err);
        const guessed = guessCountry();
        const fallback = guessed ? `${guessed}, Remote` : "Remote";
        setLocationInput(fallback);
      }
    );
  }, []);

  const handleLocationChange = (val: string) => {
    setLocationInput(val);
    localStorage.setItem("aura_location_filter", val);
  };

  /* entrance: title block prints, the scan form rises */
  useEffect(() => {
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.65 } });
      tl.from(q(".page-head > *"), { y: 22, autoAlpha: 0, stagger: 0.1 }).from(
        q(".scan-form-panel"),
        { y: 28, autoAlpha: 0, duration: 0.7 },
        "-=0.35"
      );
    });
    return () => mm.revert();
  }, []);

  /* results register: header rules in, rows file in from the left */
  useEffect(() => {
    if (!jobs?.length) return;
    const mm = gsap.matchMedia(root);
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const q = gsap.utils.selector(root);
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(q(".scan-results-head"), { autoAlpha: 0, duration: 0.4 }).from(
        q(".job-row"),
        { x: -18, autoAlpha: 0, duration: 0.5, stagger: 0.05 },
        "-=0.15"
      );
    });
    return () => mm.revert();
  }, [jobs]);

  async function run() {
    setError("");
    setScanErrors([]);
    setBusy(true);
    setJobs(null);
    try {
      const kw = keywords.split(",").map((s) => s.trim()).filter(Boolean);
      const locs = locationInput.split(",").map((s) => s.trim()).filter(Boolean);
      const r = await api.scan({
        ...(kw.length ? { title_keywords: kw } : {}),
        ...(locs.length ? { location_keywords: locs } : {}),
      });
      setJobs(r.jobs);
      // The backend returns 200 with an empty job list even when it never
      // actually scanned anything (e.g. misconfigured portals.yml) — surface
      // those errors instead of letting them masquerade as "no roles found".
      if (r.errors?.length) setScanErrors(r.errors);
    } catch {
      setError("Scan failed — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-sheet" ref={root}>
      <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
        <div className="page-head">
          <Link href="/tracker" className="back-link">
            ← Jobs
          </Link>
          <div className="page-kicker">(01) // PORTAL_SCAN</div>
          <h1>Find open roles</h1>
          <p>
            Aura checks the live job boards of tracked companies directly —
            no stale listings, no scraping middlemen.
          </p>
        </div>

        {error && <div className="notice notice-error">{error}</div>}

        <div className="panel scan-form-panel" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            <div className="field">
              <label htmlFor="kw">Role keywords <span style={{ fontWeight: 400, color: "var(--ink-55)", fontSize: "0.8rem" }}>(optional, comma-separated)</span></label>
              <input
                id="kw"
                className="input"
                placeholder="AI Engineer, Forward Deployed, Solutions"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="loc">Locations <span style={{ fontWeight: 400, color: "var(--ink-55)", fontSize: "0.8rem" }}>(optional, comma-separated)</span></label>
              <input
                id="loc"
                className="input"
                placeholder="Malaysia, Remote, Singapore"
                value={locationInput}
                onChange={(e) => handleLocationChange(e.target.value)}
              />
            </div>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            Scan job boards
          </button>
        </div>


        {busy && (
          <div className="panel">
            <Thinking lines={[
              "Checking company job boards…",
              "Filtering titles to your targets…",
            ]} />
          </div>
        )}

        {jobs && (
          <>
            <div className="scan-results-head">
              <span className="page-kicker" style={{ margin: 0 }}>
                (02) // RESULTS
              </span>
              <span className="scan-results-count">
                {jobs.length === 0 ? "0 ROLES_FOUND" : `${jobs.length} ROLES_FOUND`}
              </span>
            </div>
            {jobs.length === 0 && scanErrors.length === 0 && (
              <p style={{ marginBottom: "1rem", color: "var(--ink-72)" }}>
                No matching roles right now — try broader keywords or check back
                in a few days.
              </p>
            )}
            {/* Per-company skip/404 noise is normal even on a successful scan —
                only worth surfacing as an error when it explains a genuinely
                empty result, otherwise it'd alarm users over 30+ real hits. */}
            {jobs.length === 0 && scanErrors.length > 0 && (
              <div className="notice notice-error" style={{ marginBottom: "1rem" }}>
                <p style={{ margin: 0, fontWeight: 600 }}>
                  The scan didn&apos;t run correctly — this isn&apos;t &quot;no roles found&quot;.
                </p>
                <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.2rem" }}>
                  {scanErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              {jobs.map((j) => (
                <div className="job-row" key={j.url}>
                  <div style={{ minWidth: 0 }}>
                    <div className="job-title">{j.title}</div>
                    <div className="job-meta">
                      {j.company}{j.location ? ` · ${j.location}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
                    <a href={j.url} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: "0.45rem 1rem", fontSize: "0.84rem" }}>
                      View
                    </a>
                    <button
                      className="btn btn-primary"
                      style={{ padding: "0.45rem 1rem", fontSize: "0.84rem" }}
                      onClick={() => router.push(`/evaluate?url=${encodeURIComponent(j.url)}`)}
                    >
                      Score it
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
