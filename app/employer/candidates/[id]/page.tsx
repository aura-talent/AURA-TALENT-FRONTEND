import Link from "next/link";
import { notFound } from "next/navigation";
import { candidates } from "../../data";

export default async function CandidateDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const candidate = candidates.find((item) => item.id === id);
  if (!candidate) notFound();

  return (
    <div className="employer-page">
      <Link href="/employer/candidates" className="back-link">← All candidates</Link>
      <div className="candidate-profile-head panel">
        <div className="candidate-profile-person"><span className="candidate-avatar candidate-avatar-large">{candidate.initials}</span><div><div className="candidate-name-row"><h1>{candidate.name}</h1><span className="chip chip-tier-high">High confidence</span></div><p>{candidate.role} · {candidate.location} · {candidate.experience}</p><div className="candidate-skill-row">{candidate.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div></div></div>
        <div className="candidate-profile-actions"><select className="select" defaultValue={candidate.stage}><option>New</option><option>Screening</option><option>Assessment</option><option>Interview</option><option>Final review</option><option>Offer</option></select><button className="btn btn-primary">Message candidate</button></div>
      </div>
      <div className="candidate-detail-grid">
        <main>
          <section className="panel employer-section"><div className="employer-section-head"><div><p className="eyebrow">Aura assessment</p><h2>Why {candidate.name.split(" ")[0]} stands out</h2></div></div><p className="assessment-lede">A strong, evidence-backed match with consistent signals across portfolio depth, role-specific skills, and structured interview responses.</p><div className="evidence-list"><div><span>01</span><p><strong>Direct problem-space experience</strong>Led end-to-end product work in a comparable B2B environment, including discovery, prototyping, and launch measurement.</p></div><div><span>02</span><p><strong>High interview consistency</strong>Examples were specific and measurable, with clear ownership and thoughtful trade-off reasoning.</p></div><div><span>03</span><p><strong>Career preference alignment</strong>Team size, growth path, hybrid expectations, and compensation are aligned with the open role.</p></div></div></section>
          <section className="panel employer-section"><div className="employer-section-head"><div><h2>Interview highlights</h2><p>AI-reviewed from the simulated interview</p></div><Link href="/employer/interviews">View transcript →</Link></div><div className="interview-highlights"><blockquote>“I measure design quality by whether the team can make better decisions after the work, not only by whether the interface looks polished.”</blockquote><div className="highlight-signals"><span><b>92</b>Communication</span><span><b>96</b>Problem solving</span><span><b>89</b>Leadership</span></div></div></section>
        </main>
        <aside>
          <section className="panel scorecard-panel"><div className="profile-match-ring"><strong>{candidate.score}</strong><span>% match</span></div><div className="scorecard-bars">{[["Resume evidence", candidate.resume], ["Interview", candidate.interview], ["Skills", 91], ["Preferences", 88], ["Culture", 90]].map(([label, value]) => <div key={label}><span><b>{label}</b><em>{value}</em></span><i><u style={{ width: `${value}%` }} /></i></div>)}</div></section>
          <section className="panel employer-section profile-note"><h3>Compensation alignment</h3><p>Candidate expectation</p><strong>RM 13k–15k / month</strong><small>Within the approved role range. Candidate values learning budget and flexible work.</small></section>
        </aside>
      </div>
    </div>
  );
}
