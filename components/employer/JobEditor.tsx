"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  defaultMetricPriorities,
  evaluationMetrics,
  scoringDimensions,
  type EvaluationMetricKey,
  type ScoringDimensionKey,
} from "@/app/employer/data";

type JobSeed = {
  title?: string;
  team?: string;
  location?: string;
  employmentType?: string;
  salary?: string;
  description?: string;
  keywords?: string[];
  mockInterviewEnabled?: boolean;
  interviewQuestions?: number;
};

type CustomCriterion = { id: number; name: string; priority: number };

const workflowSteps = [
  {
    label: "Job ingestion & extraction",
    detail: "Structure role, skills, salary, and requirements",
  },
  {
    label: "ATS resume match",
    detail: "Score evidence against prioritized keywords",
  },
  {
    label: "Multi-dimensional evaluation",
    detail: "Apply WLC across configured hiring signals",
  },
  {
    label: "Q&A preparation",
    detail: "Generate structured interview questions and rubric",
  },
  {
    label: "Decision logging",
    detail: "Keep score changes and reviewer actions auditable",
  },
];

export default function JobEditor({
  mode,
  initialJob = {},
}: {
  mode: "create" | "edit";
  initialJob?: JobSeed;
}) {
  const router = useRouter();
  const [source, setSource] = useState<"manual" | "paste" | "url">("manual");
  const [priorities, setPriorities] = useState(defaultMetricPriorities);
  const [dimensionWeights, setDimensionWeights] = useState<
    Record<ScoringDimensionKey, number>
  >(
    () =>
      Object.fromEntries(
        scoringDimensions.map((dimension) => [dimension.key, dimension.weight]),
      ) as Record<ScoringDimensionKey, number>,
  );
  const [keywords, setKeywords] = useState(
    initialJob.keywords ?? ["product strategy", "design systems"],
  );
  const [keywordDraft, setKeywordDraft] = useState("");
  const [mockInterviewEnabled, setMockInterviewEnabled] = useState(
    initialJob.mockInterviewEnabled ?? true,
  );
  const [interviewQuestions, setInterviewQuestions] = useState(
    initialJob.interviewQuestions ?? 6,
  );
  const [customCriteria, setCustomCriteria] = useState<CustomCriterion[]>([
    { id: 1, name: "Portfolio evidence", priority: 8 },
  ]);
  const [enabledWorkflow, setEnabledWorkflow] = useState(() =>
    workflowSteps.map(() => true),
  );
  const [saved, setSaved] = useState(false);

  const totalPriority = useMemo(
    () =>
      Object.values(priorities).reduce(
        (total, priority) => total + priority,
        0,
      ) +
      customCriteria.reduce(
        (total, criterion) => total + criterion.priority,
        0,
      ),
    [priorities, customCriteria],
  );
  const totalDimensionWeight = Object.values(dimensionWeights).reduce(
    (total, weight) => total + weight,
    0,
  );

  function setPriority(key: EvaluationMetricKey, value: number) {
    setPriorities((current) => ({ ...current, [key]: value }));
  }

  function addKeyword() {
    const value = keywordDraft.trim();
    if (
      !value ||
      keywords.some((keyword) => keyword.toLowerCase() === value.toLowerCase())
    )
      return;
    setKeywords((current) => [...current, value]);
    setKeywordDraft("");
  }

  function saveJob() {
    setSaved(true);
    window.setTimeout(() => router.push("/employer/jobs"), 650);
  }

  return (
    <div className="employer-page job-editor-page">
      <div className="employer-page-head">
        <div>
          <p className="eyebrow">
            {mode === "create" ? "New role" : "Scoring configuration"}
          </p>
          <h1>
            {mode === "create" ? "Create a job" : `Edit ${initialJob.title}`}
          </h1>
          <p>
            Define the role once, then let Aura carry the same priorities
            through screening, interviews, and final evaluation.
          </p>
        </div>
        <div className="job-editor-actions">
          <button
            className="btn btn-ghost"
            onClick={() => router.push("/employer/jobs")}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={totalDimensionWeight !== 100}
            onClick={saveJob}
          >
            {saved
              ? "Saved ✓"
              : mode === "create"
                ? "Create job"
                : "Save changes"}
          </button>
        </div>
      </div>

      <div className="job-editor-layout">
        <main>
          <section className="panel employer-section editor-section">
            <div className="editor-section-title">
              <span>01</span>
              <div>
                <h2>Job ingestion</h2>
                <p>
                  Start manually, paste a description, or extract from an
                  existing listing.
                </p>
              </div>
            </div>
            <div className="tabs" role="tablist">
              {(["manual", "paste", "url"] as const).map((item) => (
                <button
                  className="tab"
                  role="tab"
                  aria-selected={source === item}
                  key={item}
                  onClick={() => setSource(item)}
                >
                  {item === "manual"
                    ? "Build manually"
                    : item === "paste"
                      ? "Paste description"
                      : "Import URL"}
                </button>
              ))}
            </div>
            {source === "url" && (
              <div className="ingestion-box">
                <div className="field">
                  <label>Job listing URL</label>
                  <input
                    className="input"
                    type="url"
                    placeholder="https://linkedin.com/jobs/view/..."
                  />
                </div>
                <button className="btn btn-ghost">Extract job details</button>
              </div>
            )}
            {source === "paste" && (
              <div className="ingestion-box">
                <div className="field">
                  <label>Existing job description</label>
                  <textarea
                    className="input"
                    placeholder="Paste the full job description. Aura will extract responsibilities, requirements, salary, and keywords."
                  />
                </div>
                <button className="btn btn-ghost">Extract and structure</button>
              </div>
            )}
            <div className="form-grid">
              <div className="field">
                <label>Job title</label>
                <input
                  className="input"
                  defaultValue={initialJob.title}
                  placeholder="e.g. Senior Product Designer"
                />
              </div>
              <div className="field">
                <label>Team</label>
                <select
                  className="input"
                  defaultValue={initialJob.team ?? "Product"}
                >
                  <option>Product</option>
                  <option>Engineering</option>
                  <option>People</option>
                  <option>Go to market</option>
                </select>
              </div>
              <div className="field">
                <label>Location</label>
                <input
                  className="input"
                  defaultValue={initialJob.location}
                  placeholder="Kuala Lumpur · Hybrid"
                />
              </div>
              <div className="field">
                <label>Employment type</label>
                <select
                  className="input"
                  defaultValue={initialJob.employmentType ?? "Full-time"}
                >
                  <option>Full-time</option>
                  <option>Part-time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
              </div>
              <div className="field">
                <label>Compensation / allowance</label>
                <input
                  className="input"
                  defaultValue={initialJob.salary}
                  placeholder="RM 12,000–16,000 / month"
                />
              </div>
              <div className="field">
                <label>Hiring target</label>
                <input
                  className="input"
                  type="number"
                  min="1"
                  defaultValue="2"
                />
              </div>
            </div>
            <div className="field">
              <label>Role description and outcomes</label>
              <textarea
                className="input"
                defaultValue={initialJob.description}
                placeholder="What will this person own, and what does success look like?"
              />
            </div>
          </section>

          <section className="panel employer-section editor-section">
            <div className="editor-section-title">
              <span>02</span>
              <div>
                <h2>Mock interview</h2>
                <p>
                  Attach an employer-provided simulation to this job. Candidates
                  may apply, interview, or complete both.
                </p>
              </div>
            </div>
            <label className="interview-enable-row">
              <input
                type="checkbox"
                checked={mockInterviewEnabled}
                onChange={(event) =>
                  setMockInterviewEnabled(event.target.checked)
                }
              />
              <span className="workflow-check">✓</span>
              <span>
                <strong>Enable mock interview for this job</strong>
                <small>
                  Interview evidence is optional. Candidates without an attempt
                  can still be evaluated from their application profile.
                </small>
              </span>
            </label>
            {mockInterviewEnabled && (
              <div className="job-interview-config">
                <div className="field">
                  <label>Number of questions</label>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    max="12"
                    value={interviewQuestions}
                    onChange={(event) =>
                      setInterviewQuestions(Number(event.target.value))
                    }
                  />
                </div>
                <div className="field">
                  <label>Candidate response mode</label>
                  <select className="input">
                    <option>Video, voice, or text</option>
                    <option>Video only</option>
                    <option>Voice or text</option>
                  </select>
                </div>
                <div className="field">
                  <label>Attempt policy</label>
                  <select className="input">
                    <option>Optional after application</option>
                    <option>Optional before or after applying</option>
                    <option>Required before review</option>
                  </select>
                </div>
                <Link href="/employer/interviews" className="btn btn-ghost">
                  Set up questions →
                </Link>
              </div>
            )}
          </section>

          <section className="panel employer-section editor-section">
            <div className="editor-section-title">
              <span>03</span>
              <div>
                <h2>Prioritized ATS keywords</h2>
                <p>
                  These terms receive extra attention during resume evidence
                  extraction and matching.
                </p>
              </div>
            </div>
            <div className="keyword-editor">
              <div className="keyword-input">
                <input
                  value={keywordDraft}
                  onChange={(event) => setKeywordDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addKeyword();
                    }
                  }}
                  placeholder="Add a skill, tool, domain, or qualification"
                />
                <button onClick={addKeyword}>Add</button>
              </div>
              <div className="priority-keywords">
                {keywords.map((keyword, index) => (
                  <span key={keyword}>
                    <b>{index < 3 ? "High" : "Standard"}</b>
                    {keyword}
                    <button
                      onClick={() =>
                        setKeywords((current) =>
                          current.filter((item) => item !== keyword),
                        )
                      }
                      aria-label={`Remove ${keyword}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <div className="notice notice-info editor-notice">
              <strong>Auto-generated ATS resume match is enabled.</strong> Aura
              will match equivalent evidence and context, not only exact keyword
              occurrences.
            </div>
          </section>

          <section className="panel employer-section editor-section">
            <div className="editor-section-title">
              <span>04</span>
              <div>
                <h2>Single scoring system</h2>
                <p>
                  Prioritize the evidence Aura evaluates, then configure how the
                  four awarded dimension scores build the final result.
                </p>
              </div>
            </div>
            <div className="scoring-flow">
              <span>6 evaluation metrics</span>
              <b>→</b>
              <span>Evidence evaluated</span>
              <b>→</b>
              <span>4 dimension scores</span>
              <b>→</b>
              <span>Final WLC score</span>
            </div>
            <div className="scoring-subhead">
              <div>
                <h3>Evaluation metric priorities</h3>
                <p>
                  Priority controls how deeply each metric is considered while
                  awarding the four dimension scores. It is not a separate
                  score.
                </p>
              </div>
              <b>{totalPriority} priority points</b>
            </div>
            <div className="metric-priority-list">
              {evaluationMetrics.map((metric) => {
                return (
                  <div className="metric-priority-row" key={metric.key}>
                    <div>
                      <strong>{metric.label}</strong>
                      <p>{metric.description}</p>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={priorities[metric.key]}
                      onChange={(event) =>
                        setPriority(metric.key, Number(event.target.value))
                      }
                      aria-label={`${metric.label} priority`}
                    />
                    <span className="priority-value">
                      {priorities[metric.key]}
                      <small>/ 10</small>
                    </span>
                    <span className="normalized-weight">Evidence</span>
                  </div>
                );
              })}
              {customCriteria.map((criterion) => (
                <div className="metric-priority-row custom" key={criterion.id}>
                  <div>
                    <input
                      className="criterion-name"
                      value={criterion.name}
                      onChange={(event) =>
                        setCustomCriteria((current) =>
                          current.map((item) =>
                            item.id === criterion.id
                              ? { ...item, name: event.target.value }
                              : item,
                          ),
                        )
                      }
                      aria-label="Custom criterion name"
                    />
                    <p>Custom role-specific evaluation add-on</p>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={criterion.priority}
                    onChange={(event) =>
                      setCustomCriteria((current) =>
                        current.map((item) =>
                          item.id === criterion.id
                            ? { ...item, priority: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                  />
                  <span className="priority-value">
                    {criterion.priority}
                    <small>/ 10</small>
                  </span>
                  <button
                    className="remove-criterion"
                    onClick={() =>
                      setCustomCriteria((current) =>
                        current.filter((item) => item.id !== criterion.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              className="add-criterion"
              onClick={() =>
                setCustomCriteria((current) => [
                  ...current,
                  { id: Date.now(), name: "New criterion", priority: 5 },
                ])
              }
            >
              ＋ Add custom criterion
            </button>
            <div className="scoring-divider" />
            <div className="scoring-subhead">
              <div>
                <h3>Final score weights</h3>
                <p>
                  Metric findings are awarded into these dimensions. Their
                  weighted combination is the candidate&apos;s only final score.
                </p>
              </div>
              <b
                className={
                  totalDimensionWeight === 100
                    ? "weight-valid"
                    : "weight-invalid"
                }
              >
                {totalDimensionWeight}% total
              </b>
            </div>
            <div className="dimension-weight-editor">
              {scoringDimensions.map((dimension) => (
                <div key={dimension.key}>
                  <div>
                    <strong>{dimension.label}</strong>
                    <p>{dimension.description}</p>
                  </div>
                  <input
                    type="range"
                    min={dimension.key === "technical" ? 35 : 10}
                    max={dimension.key === "technical" ? 40 : 35}
                    value={dimensionWeights[dimension.key]}
                    onChange={(event) =>
                      setDimensionWeights((current) => ({
                        ...current,
                        [dimension.key]: Number(event.target.value),
                      }))
                    }
                    aria-label={`${dimension.label} weight`}
                  />
                  <span>{dimensionWeights[dimension.key]}%</span>
                </div>
              ))}
            </div>
            <div className="wlc-summary">
              <span>Weighted Linear Combination</span>
              <code>
                Final = Technical × {dimensionWeights.technical}% + Problem
                solving × {dimensionWeights.problemSolving}% + Communication ×{" "}
                {dimensionWeights.communication}% + Culture/system ×{" "}
                {dimensionWeights.culture}%
              </code>
              <b>
                {totalDimensionWeight === 100 ? "Ready" : "Must total 100%"}
              </b>
            </div>
            <Link className="editor-text-action" href="/employer/interviews">
              Customize questions and rubric →
            </Link>
          </section>
        </main>

        <aside>
          <section className="panel employer-section workflow-config">
            <p className="eyebrow">Dynamic workflow</p>
            <h2>Automation steps</h2>
            <p className="workflow-intro">
              Choose which steps Aura runs for every candidate in this role.
            </p>
            <div className="workflow-step-list">
              {workflowSteps.map((step, index) => (
                <label key={step.label}>
                  <input
                    type="checkbox"
                    checked={enabledWorkflow[index]}
                    onChange={() =>
                      setEnabledWorkflow((current) =>
                        current.map((enabled, itemIndex) =>
                          itemIndex === index ? !enabled : enabled,
                        ),
                      )
                    }
                  />
                  <span className="workflow-check">✓</span>
                  <span>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </section>
          <section className="panel employer-section scoring-preview">
            <p className="eyebrow">Scoring preview</p>
            <h2>One final score</h2>
            <div
              className="priority-donut"
              style={{
                background: `radial-gradient(circle, var(--surface) 58%, transparent 59%), conic-gradient(var(--iris) 0 34%, var(--aura-a) 34% 58%, var(--aura-c) 58% 78%, var(--aura-b) 78% 100%)`,
              }}
            >
              <strong>
                {evaluationMetrics.length + customCriteria.length}
              </strong>
              <span>signals</span>
            </div>
            <p>
              {evaluationMetrics.length + customCriteria.length} evidence
              signals feed four awarded dimensions, which produce one
              explainable WLC result.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
