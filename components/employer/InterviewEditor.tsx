"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { employerApi, type EmployerJob } from "@/lib/employerApi";

const interviewMetrics = [
  {
    key: "content",
    label: "Content",
    description: "Relevance, depth, examples, and role-specific knowledge",
  },
  {
    key: "clarity",
    label: "Clarity",
    description: "Structure, precision, and ease of understanding",
  },
  {
    key: "confidence",
    label: "Confidence",
    description: "Conviction, composure, and ownership of responses",
  },
  {
    key: "bodyLanguage",
    label: "Body language",
    description: "Eye contact, posture, expression, and visual presence",
  },
] as const;

type MetricKey = (typeof interviewMetrics)[number]["key"];

export default function InterviewEditor({ job }: { job: EmployerJob }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<string[]>(
    job.interview_questions.length
      ? job.interview_questions.map(String)
      : [""],
  );
  const [metricPriorities, setMetricPriorities] = useState<
    Record<MetricKey, number>
  >({
    content: 10,
    clarity: 8,
    confidence: 7,
    bodyLanguage: 5,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const cleaned = questions.map((q) => q.trim()).filter(Boolean);
    try {
      await employerApi.updateJob(job.id, {
        interview_questions: cleaned,
        mock_interview_enabled: true,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      console.error("Failed to save interview:", err);
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="employer-page">

      <div className="employer-page-head">
        <div>
          <p className="eyebrow">AI interview studio</p>
          <h1>Customize interview</h1>
          <p>
            Configure how Aura asks questions and evaluates every candidate for
            this role.
          </p>
        </div>
        <div className="interview-header-actions flex">
          <button
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
          >
            {saved ? "Saved ✓" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <p className="notice notice-error">{error}</p>}

      <div className="interview-builder-grid">
        <div>
          <section className="panel employer-section">
            <div className="form-grid">
              <div className="field">
                <label htmlFor="interview-role">Open role</label>
                <input
                  id="interview-role"
                  className="input"
                  value={job.title}
                  readOnly
                />
              </div>
              <div className="field">
                <label>Interview length</label>
                <select className="input">
                  <option>30 minutes</option>
                  <option>45 minutes</option>
                  <option>60 minutes</option>
                </select>
              </div>
            </div>

            <div className="interview-metric-head">
              <div>
                <h2>Evaluation priorities</h2>
                <p>
                  Set how strongly Aura should emphasize each signal when
                  evaluating interview responses.
                </p>
              </div>
              <span className="chip">Priority 1–10</span>
            </div>

            <div className="interview-metric-list">
              {interviewMetrics.map((metric) => (
                <div key={metric.key}>
                  <div>
                    <strong>{metric.label}</strong>
                    <p>{metric.description}</p>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={metricPriorities[metric.key]}
                    onChange={(event) =>
                      setMetricPriorities((current) => ({
                        ...current,
                        [metric.key]: Number(event.target.value),
                      }))
                    }
                    aria-label={`${metric.label} priority`}
                  />
                  <span>
                    {metricPriorities[metric.key]}
                    <small>/ 10</small>
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <h2>Interview questions</h2>
                <p>{questions.length} questions</p>
              </div>
            </div>
            <div className="question-list">
              {questions.map((question, index) => (
                <div key={index}>
                  <span className="question-handle">⠿</span>
                  <span className="question-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <textarea
                    value={question}
                    onChange={(event) =>
                      setQuestions(
                        questions.map((item, itemIndex) =>
                          itemIndex === index ? event.target.value : item,
                        ),
                      )
                    }
                    aria-label={`Question ${index + 1}`}
                  />
                  <button
                    onClick={() =>
                      setQuestions(
                        questions.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={`Remove question ${index + 1}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="add-question"
                onClick={() => setQuestions([...questions, ""])}
              >
                ＋ Add question
              </button>
            </div>
          </section>
        </div>

        <aside>
          <section className="panel employer-section interview-preview">
            <p className="eyebrow">Candidate preview</p>
            <div className="preview-orb">
              <div className="aura-glow" />
            </div>
            <span className="mono">Question 1 of {questions.length}</span>
            <h2>{questions[0] || "Add your first question"}</h2>
            <p>
              Candidates can answer by video, voice, or text. Follow-up prompts
              adapt to their response.
            </p>
            <div className="preview-wave">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </section>
          <section className="notice notice-info">
            <strong>Evaluation priorities ready.</strong>
            <br />
            Aura will score content, clarity, confidence, and body language
            using the priorities configured here.
          </section>
        </aside>
      </div>
    </div>
  );
}
