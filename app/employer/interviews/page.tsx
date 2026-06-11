"use client";

import { useState } from "react";

const initialQuestions = [
  "Walk me through a product decision where user needs and business goals were in tension.",
  "Tell me about a time research changed the direction of your work.",
  "How do you bring engineers and product managers into the design process?",
  "Describe a project that did not land as expected. What did you learn?",
];

export default function InterviewsPage() {
  const [questions, setQuestions] = useState(initialQuestions);
  const [context, setContext] = useState(
    "We need a senior designer who can establish design systems, influence product strategy, and work closely with a distributed engineering team.",
  );
  const [saved, setSaved] = useState(false);
  return (
    <div className="employer-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">AI interview studio</p>
          <h1>Build a structured interview</h1>
          <p>
            Aura drafts role-specific questions and evaluates every candidate
            against the same evidence.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2200);
          }}
        >
          {saved ? "Interview saved ✓" : "Save interview"}
        </button>
      </div>
      <div className="interview-builder-grid">
        <div>
          <section className="panel employer-section">
            <div className="form-grid">
              <div className="field">
                <label>Open role</label>
                <select className="input">
                  <option>Senior Product Designer</option>
                  <option>Frontend Engineer</option>
                  <option>AI Product Manager</option>
                </select>
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
            <div className="field">
              <label htmlFor="context">What matters for this hire?</label>
              <textarea
                id="context"
                className="input interview-context"
                value={context}
                onChange={(event) => setContext(event.target.value)}
              />
            </div>
            <button
              className="btn btn-ghost"
              onClick={() =>
                setQuestions([
                  ...initialQuestions,
                  "How would you improve an established product without disrupting the current customer base?",
                ])
              }
            >
              ✦ Regenerate with AI
            </button>
          </section>
          <section className="panel employer-section">
            <div className="employer-section-head">
              <div>
                <h2>Interview questions</h2>
                <p>
                  {questions.length} questions · drag to reorder in the
                  connected version
                </p>
              </div>
            </div>
            <div className="question-list">
              {questions.map((question, index) => (
                <div key={`${question}-${index}`}>
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
            <h2>{questions[0]}</h2>
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
            <button className="btn btn-primary">Start preview</button>
          </section>
          <section className="notice notice-info">
            <strong>Evaluation rubric ready.</strong>
            <br />
            Aura will score communication, role knowledge, problem solving, and
            evidence quality.
          </section>
        </aside>
      </div>
    </div>
  );
}
