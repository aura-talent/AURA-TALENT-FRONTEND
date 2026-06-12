"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

const suggestedCultureValues = [
  "High ownership",
  "Direct feedback",
  "Flexible hybrid",
  "Learning budget",
  "Inclusive teams",
  "Outcome focused",
];

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [selectedCultureValues, setSelectedCultureValues] = useState(
    suggestedCultureValues,
  );
  const [customCultureValues, setCustomCultureValues] = useState<string[]>([]);
  const [cultureDraft, setCultureDraft] = useState("");

  function addCultureValue() {
    const value = cultureDraft.trim();
    const allValues = [...suggestedCultureValues, ...customCultureValues];

    if (
      !value ||
      allValues.some((item) => item.toLowerCase() === value.toLowerCase())
    ) {
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
    setCustomCultureValues((current) =>
      current.filter((item) => item !== value),
    );
    setSelectedCultureValues((current) =>
      current.filter((item) => item !== value),
    );
  }

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
        <button
          className="btn btn-primary"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? "Changes saved ✓" : "Save changes"}
        </button>
      </div>
      <div className="profile-layout">
        <main>
          <section className="panel employer-section">
            <div className="profile-banner">
              <div className="aura-glow" />
              <span className="company-logo-large">N</span>
              <button className="btn btn-ghost">Change cover</button>
            </div>
            <div className="form-grid">
              <div className="field">
                <label>Company name</label>
                <input className="input" defaultValue="Northstar Labs" />
              </div>
              <div className="field">
                <label>Industry</label>
                <input
                  className="input"
                  defaultValue="B2B software · Artificial intelligence"
                />
              </div>
              <div className="field">
                <label>Company size</label>
                <select className="input" defaultValue="101–250">
                  <option>51–100</option>
                  <option>101–250</option>
                  <option>251–500</option>
                </select>
              </div>
              <div className="field">
                <label>Headquarters</label>
                <input
                  className="input"
                  defaultValue="Kuala Lumpur, Malaysia"
                />
              </div>
            </div>
            <div className="field">
              <label>What candidates should know</label>
              <textarea
                className="input"
                defaultValue="We build practical AI products that help operations teams make better decisions. Our teams are small, senior, and trusted to own problems from first conversation to measurable outcome."
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
              {[...suggestedCultureValues, ...customCultureValues].map(
                (value) => {
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
                },
              )}
            </div>
            <div className="culture-custom-field">
              <div>
                <strong>Add a custom culture or benefit</strong>
                <p>
                  Add anything important to candidates that is not listed
                  above.
                </p>
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
                defaultValue="Twice-yearly growth conversations, transparent competency frameworks, and a RM 4,000 annual learning budget."
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
              <strong>88</strong>
              <span>out of 100</span>
            </div>
            <ul>
              <li className="done">Company overview</li>
              <li className="done">Culture and benefits</li>
              <li className="done">Hiring process</li>
              <li>Salary philosophy</li>
              <li>Employee experiences</li>
            </ul>
            <p className="notice notice-info">
              Profiles above 85 receive 24% more completed applications.
            </p>
          </section>
          <section className="panel employer-section linkedin-card">
            <span className="linkedin-mark">in</span>
            <div>
              <strong>LinkedIn connected</strong>
              <p>Last synced 2 hours ago</p>
            </div>
            <button className="btn btn-ghost">Sync</button>
          </section>
        </aside>
      </div>
    </div>
  );
}
