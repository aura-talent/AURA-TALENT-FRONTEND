"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { employerApi, type EmployerProfile } from "@/lib/employerApi";

const suggestedCultureValues = [
  "High ownership",
  "Direct feedback",
  "Flexible hybrid",
  "Learning budget",
  "Inclusive teams",
  "Outcome focused",
];

const companySizes = ["1–10", "11–50", "51–100", "101–250", "251–500", "500+"];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("11–50");
  const [headquarters, setHeadquarters] = useState("");
  const [about, setAbout] = useState("");
  const [careerGrowth, setCareerGrowth] = useState("");

  // Culture values: suggested defaults + any custom ones the employer saved,
  // with a selected subset.
  const [customCultureValues, setCustomCultureValues] = useState<string[]>([]);
  const [selectedCultureValues, setSelectedCultureValues] = useState<string[]>(
    suggestedCultureValues,
  );
  const [cultureDraft, setCultureDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    employerApi
      .getProfile()
      .then((profile: EmployerProfile) => {
        if (cancelled) return;
        setCompanyName(profile.company_name ?? "");
        setIndustry(profile.industry ?? "");
        setCompanySize(profile.company_size ?? "11–50");
        setHeadquarters(profile.headquarters ?? "");
        setAbout(profile.about ?? "");
        setCareerGrowth(profile.career_growth ?? "");
        const saved = profile.culture_values ?? [];
        const custom = saved.filter((v) => !suggestedCultureValues.includes(v));
        setCustomCultureValues(custom);
        setSelectedCultureValues(saved.length ? saved : suggestedCultureValues);
      })
      .catch(() => {
        /* no profile row yet — the first save creates it */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function addCultureValue() {
    const value = cultureDraft.trim();
    const allValues = [...suggestedCultureValues, ...customCultureValues];
    if (!value || allValues.some((item) => item.toLowerCase() === value.toLowerCase())) {
      return;
    }
    setCustomCultureValues((current) => [...current, value]);
    setSelectedCultureValues((current) => [...current, value]);
    setCultureDraft("");
  }

  function toggleCultureValue(value: string) {
    setSelectedCultureValues((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  }

  function removeCustomCultureValue(value: string) {
    setCustomCultureValues((current) => current.filter((item) => item !== value));
    setSelectedCultureValues((current) => current.filter((item) => item !== value));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await employerApi.upsertProfile({
        company_name: companyName,
        industry,
        company_size: companySize,
        headquarters,
        about,
        career_growth: careerGrowth,
        culture_values: selectedCultureValues,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const transparencyScore = Math.round(
    ([companyName, industry, companySize, headquarters, about, careerGrowth].filter(
      Boolean,
    ).length /
      6) *
      100,
  );

  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">Candidate-facing profile</p>
          <h1>Company profile</h1>
          <p>
            Give candidates the context they need to make a confident, informed
            decision.
          </p>
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving || loading}>
          {saved ? "Changes saved ✓" : saving ? "Saving…" : "Save changes"}
        </button>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className="profile-layout">
        <main>
          <section className="panel employer-section">
            <div className="profile-banner">
              <div className="aura-glow" />
              <span className="company-logo-large">
                {(companyName || "N").slice(0, 1).toUpperCase()}
              </span>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Company name</label>
                <input
                  className="input"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="e.g. Aura Talent"
                />
              </div>
              <div className="field">
                <label>Industry</label>
                <input
                  className="input"
                  value={industry}
                  onChange={(event) => setIndustry(event.target.value)}
                  placeholder="e.g. B2B software · Artificial intelligence"
                />
              </div>
              <div className="field">
                <label>Company size</label>
                <select
                  className="input"
                  value={companySize}
                  onChange={(event) => setCompanySize(event.target.value)}
                >
                  {companySizes.map((size) => (
                    <option key={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Headquarters</label>
                <input
                  className="input"
                  value={headquarters}
                  onChange={(event) => setHeadquarters(event.target.value)}
                  placeholder="e.g. Kuala Lumpur, Malaysia"
                />
              </div>
            </div>
            <div className="field">
              <label>What candidates should know</label>
              <textarea
                className="input"
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                placeholder="Describe your company, mission, and what makes it a great place to work."
              />
            </div>
          </section>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <h2>Culture and benefits</h2>
                <p>These signals are included in candidate matching.</p>
              </div>
            </div>
            <div className="culture-values">
              {[...suggestedCultureValues, ...customCultureValues].map((value) => {
                const isCustom = customCultureValues.includes(value);
                return (
                  <div className="culture-value-option" key={value}>
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedCultureValues.includes(value)}
                        onChange={() => toggleCultureValue(value)}
                      />
                      <span>{value}</span>
                    </label>
                    {isCustom && (
                      <button
                        type="button"
                        aria-label={`Remove ${value}`}
                        onClick={() => removeCustomCultureValue(value)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="culture-custom-field">
              <div>
                <strong>Add a custom culture or benefit</strong>
                <p>Add anything important to candidates that is not listed above.</p>
              </div>
              <div className="culture-custom-input">
                <input
                  className="input"
                  value={cultureDraft}
                  placeholder="e.g. Four-day work week"
                  aria-label="Custom culture or benefit"
                  onChange={(event) => setCultureDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addCultureValue();
                    }
                  }}
                />
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={!cultureDraft.trim()}
                  onClick={addCultureValue}
                >
                  <Plus size={14} /> Add
                </button>
              </div>
            </div>
            <div className="field">
              <label>Career growth</label>
              <textarea
                className="input interview-context"
                value={careerGrowth}
                onChange={(event) => setCareerGrowth(event.target.value)}
                placeholder="Describe growth conversations, competency frameworks, learning budgets, etc."
              />
            </div>
          </section>
        </main>
        <aside>
          <section className="panel employer-section transparency-card">
            <div className="employer-section-head">
              <div>
                <h2>Transparency score</h2>
                <p>Profile completeness</p>
              </div>
            </div>
            <div className="profile-match-ring">
              <strong>{transparencyScore}</strong>
              <span>out of 100</span>
            </div>
            <ul>
              <li className={companyName && about ? "done" : ""}>Company overview</li>
              <li className={selectedCultureValues.length ? "done" : ""}>
                Culture and benefits
              </li>
              <li className={careerGrowth ? "done" : ""}>Career growth</li>
              <li className={headquarters ? "done" : ""}>Location</li>
              <li className={industry ? "done" : ""}>Industry</li>
            </ul>
            <p className="notice notice-info">
              Profiles above 85 receive 24% more completed applications.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
