"use client";

import { useState } from "react";
import { jobs as initialJobs } from "../data";

export default function JobsPage() {
  const [jobs, setJobs] = useState(initialJobs);
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="employer-page">
      <div className="employer-page-head"><div><p className="eyebrow">Content and distribution</p><h1>Job listings</h1><p>Create clear roles, keep approvals visible, and track conversion from view to interview.</p></div><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>＋ Create job</button></div>
      {showForm && <section className="panel quick-job-form"><div><h2>Create a role</h2><p>Start with the essentials. Aura can draft the full listing.</p></div><div className="form-grid"><div className="field"><label>Job title</label><input className="input" placeholder="e.g. Staff Product Designer" /></div><div className="field"><label>Team</label><select className="input"><option>Product</option><option>Engineering</option><option>People</option></select></div></div><div className="field"><label>Hiring context</label><textarea className="input interview-context" placeholder="What will this person own, and why are you hiring now?" /></div><div className="hero-ctas"><button className="btn btn-primary" onClick={() => setShowForm(false)}>Generate listing</button><button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancel</button></div></section>}
      <div className="job-summary-strip"><span><b>3</b>Active</span><span><b>1</b>Draft</span><span><b>91</b>Total candidates</span><span><b>17.6%</b>Interview rate</span></div>
      <div className="panel candidate-table-wrap"><table className="table employer-table jobs-table"><thead><tr><th>Role</th><th>Status</th><th>Candidates</th><th>Interviews</th><th>Quality</th><th>Published</th><th></th></tr></thead><tbody>{jobs.map((job) => <tr key={job.title}><td><strong>{job.title}</strong><small>{job.team}</small></td><td><button className={`status-toggle ${job.status.toLowerCase()}`} onClick={() => setJobs(jobs.map((item) => item.title === job.title ? { ...item, status: item.status === "Active" ? "Draft" : "Active" } : item))}><i />{job.status}</button></td><td>{job.candidates}</td><td>{job.interviews}</td><td>{job.fit ? <span className="quality-score">{job.fit}% match</span> : "—"}</td><td>{job.age}</td><td><button className="more-button" aria-label={`More options for ${job.title}`}>•••</button></td></tr>)}</tbody></table></div>
      <section className="job-insight panel"><span className="attention-icon">✦</span><div><strong>Aura found an opportunity</strong><p>Senior Product Designer has strong applicant volume, but candidates drop before interview. The 48-hour assessment window may be too short.</p></div><button className="btn btn-ghost">Review funnel</button></section>
    </div>
  );
}
