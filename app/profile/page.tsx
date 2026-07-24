"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { api, type ResumeData } from "@/lib/api";
import { profileApi, type CandidateProfile, type ProfilePayload } from "@/lib/profileApi";
import { Loader } from "@/components/ui/loader";

type FormState = {
  fullName: string;
  contactEmail: string;
  phone: string;
  location: string;
  headline: string;
  skills: string[];
  yearsExperience: string;
  targetRoles: string[];
  salaryLow: string;
  salaryHigh: string;
  salaryCurrency: string;
  linkedinUrl: string;
  portfolioUrl: string;
};

const emptyForm: FormState = {
  fullName: "",
  contactEmail: "",
  phone: "",
  location: "",
  headline: "",
  skills: [],
  yearsExperience: "",
  targetRoles: [],
  salaryLow: "",
  salaryHigh: "",
  salaryCurrency: "USD",
  linkedinUrl: "",
  portfolioUrl: "",
};

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

function formFromProfile(profile: CandidateProfile): FormState {
  return {
    fullName: profile.full_name ?? "",
    contactEmail: profile.contact_email ?? "",
    phone: profile.phone ?? "",
    location: profile.location ?? "",
    headline: profile.headline ?? "",
    skills: profile.skills,
    yearsExperience: profile.years_experience != null ? String(profile.years_experience) : "",
    targetRoles: profile.target_roles,
    salaryLow: profile.salary_low != null ? String(profile.salary_low) : "",
    salaryHigh: profile.salary_high != null ? String(profile.salary_high) : "",
    salaryCurrency: profile.salary_currency,
    linkedinUrl: profile.linkedin_url ?? "",
    portfolioUrl: profile.portfolio_url ?? "",
  };
}

function seedFromResume(
  resumeProfile: Record<string, unknown> | undefined,
  authFullName: string,
  authEmail: string,
): FormState {
  // The résumé parser (backend ParsedResume schema) only ever produces
  // full_name, headline, years_of_experience, top_skills, and
  // target_archetypes — no phone/location/linkedin/portfolio/salary, so
  // there's nothing to seed those from; they stay manual-entry-only.
  const resumeFullName =
    typeof resumeProfile?.full_name === "string" ? resumeProfile.full_name.trim() : "";
  const years = resumeProfile?.years_of_experience;

  return {
    ...emptyForm,
    fullName: resumeFullName || authFullName,
    contactEmail: authEmail,
    headline: typeof resumeProfile?.headline === "string" ? resumeProfile.headline : "",
    skills: stringArray(resumeProfile?.top_skills),
    targetRoles: stringArray(resumeProfile?.target_archetypes),
    yearsExperience: typeof years === "number" ? String(years) : "",
  };
}

function ProfilePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [skillDraft, setSkillDraft] = useState("");
  const [roleDraft, setRoleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/profile");
      return;
    }
    let cancelled = false;
    profileApi
      .getMine(user.id)
      .then((existing) => {
        if (cancelled) return;
        if (existing) {
          setForm(formFromProfile(existing));
          setLoading(false);
          return;
        }
        const authFullName = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
        const authEmail = user.email ?? "";
        api
          .getResume()
          .then((resume: ResumeData) => {
            if (!cancelled) setForm(seedFromResume(resume.profile, authFullName, authEmail));
          })
          .catch(() => {
            if (!cancelled) setForm(seedFromResume(undefined, authFullName, authEmail));
          })
          .finally(() => {
            if (!cancelled) setLoading(false);
          });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load profile");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router]);

  function addSkill() {
    const value = skillDraft.trim();
    if (!value || form.skills.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    setForm((current) => ({ ...current, skills: [...current.skills, value] }));
    setSkillDraft("");
  }

  function addRole() {
    const value = roleDraft.trim();
    if (!value || form.targetRoles.some((r) => r.toLowerCase() === value.toLowerCase())) return;
    setForm((current) => ({ ...current, targetRoles: [...current.targetRoles, value] }));
    setRoleDraft("");
  }

  async function save() {
    if (!user) return;
    setSaving(true);
    setError(null);
    const payload: ProfilePayload = {
      full_name: form.fullName.trim() || null,
      contact_email: form.contactEmail.trim() || null,
      phone: form.phone.trim() || null,
      location: form.location.trim() || null,
      headline: form.headline.trim() || null,
      skills: form.skills,
      years_experience: form.yearsExperience ? Number(form.yearsExperience) : null,
      target_roles: form.targetRoles,
      salary_low: form.salaryLow ? Number(form.salaryLow) : null,
      salary_high: form.salaryHigh ? Number(form.salaryHigh) : null,
      salary_currency: form.salaryCurrency,
      linkedin_url: form.linkedinUrl.trim() || null,
      portfolio_url: form.portfolioUrl.trim() || null,
    };
    try {
      await profileApi.upsert(user.id, payload);
      setSaved(true);
      window.setTimeout(() => router.push("/dashboard?tour=1"), 500);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save profile");
      setSaving(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="container">
        <Loader label="Loading your profile…" />
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 820, paddingBottom: "4rem" }}>
      <div className="page-head">
        <div className="page-kicker">(01) // CANDIDATE_PROFILE</div>
        <h1>{isWelcome ? "You're all set! Let's get your profile right" : "Edit your profile"}</h1>
        <p>
          {isWelcome
            ? "We pre-filled what we could from your résumé. Fix anything that's off, and fill in the rest."
            : "Keep this up to date — it's what employers see about you beyond your résumé."}
        </p>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Basics</h2>
        <div className="form-grid">
          <div className="field">
            <label>Full name</label>
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Contact email</label>
            <input
              className="input"
              value={form.contactEmail}
              onChange={(e) => setForm((c) => ({ ...c, contactEmail: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Phone</label>
            <input
              className="input"
              value={form.phone}
              onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label>Location</label>
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm((c) => ({ ...c, location: e.target.value }))}
            />
          </div>
        </div>
        <div className="field">
          <label>Headline</label>
          <input
            className="input"
            value={form.headline}
            onChange={(e) => setForm((c) => ({ ...c, headline: e.target.value }))}
            placeholder="e.g. Senior Product Designer"
          />
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Skills & targets</h2>
        <div className="field">
          <label>Skills</label>
          <div className="tag-input-row">
            <input
              className="input"
              value={skillDraft}
              onChange={(e) => setSkillDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="e.g. React, Figma, SQL"
            />
            <button className="btn btn-ghost" onClick={addSkill}>
              Add
            </button>
          </div>
          <div className="tag-chip-list">
            {form.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
                <button
                  onClick={() =>
                    setForm((c) => ({ ...c, skills: c.skills.filter((s) => s !== skill) }))
                  }
                  aria-label={`Remove ${skill}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Target roles</label>
          <div className="tag-input-row">
            <input
              className="input"
              value={roleDraft}
              onChange={(e) => setRoleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addRole();
                }
              }}
              placeholder="e.g. Senior Backend Engineer"
            />
            <button className="btn btn-ghost" onClick={addRole}>
              Add
            </button>
          </div>
          <div className="tag-chip-list">
            {form.targetRoles.map((role) => (
              <span className="chip" key={role}>
                {role}
                <button
                  onClick={() =>
                    setForm((c) => ({ ...c, targetRoles: c.targetRoles.filter((r) => r !== role) }))
                  }
                  aria-label={`Remove ${role}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Years of experience</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.yearsExperience}
            onChange={(e) => setForm((c) => ({ ...c, yearsExperience: e.target.value }))}
          />
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1rem" }}>
        <h2>Compensation</h2>
        <div className="field">
          <label>Salary expectation ({form.salaryCurrency})</label>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={form.salaryLow}
              onChange={(e) => setForm((c) => ({ ...c, salaryLow: e.target.value }))}
              placeholder="Low"
            />
            <span>–</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1000"
              value={form.salaryHigh}
              onChange={(e) => setForm((c) => ({ ...c, salaryHigh: e.target.value }))}
              placeholder="High"
            />
          </div>
        </div>
        <div className="field">
          <label>Currency</label>
          <select
            className="input"
            value={form.salaryCurrency}
            onChange={(e) => setForm((c) => ({ ...c, salaryCurrency: e.target.value }))}
          >
            <option>MYR</option>
            <option>USD</option>
            <option>SGD</option>
          </select>
        </div>
      </div>

      <div className="panel employer-section" style={{ marginBottom: "1.5rem" }}>
        <h2>Links</h2>
        <div className="form-grid">
          <div className="field">
            <label>LinkedIn</label>
            <input
              className="input"
              value={form.linkedinUrl}
              onChange={(e) => setForm((c) => ({ ...c, linkedinUrl: e.target.value }))}
              placeholder="https://linkedin.com/in/…"
            />
          </div>
          <div className="field">
            <label>Portfolio</label>
            <input
              className="input"
              value={form.portfolioUrl}
              onChange={(e) => setForm((c) => ({ ...c, portfolioUrl: e.target.value }))}
              placeholder="https://…"
            />
          </div>
        </div>
      </div>

      <div className="hero-ctas">
        <button className="btn btn-primary" disabled={saving} onClick={save}>
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save & continue"}
        </button>
        <button className="btn btn-ghost" onClick={() => router.push("/dashboard?tour=1")}>
          Skip for now
        </button>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfilePageInner />
    </Suspense>
  );
}
