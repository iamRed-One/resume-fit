import type { Resume } from "@/lib/schemas";

export function ResumeView({ resume }: { resume: Resume }) {
  return (
    <div className="resume">
      <h1>{resume.name}</h1>
      <div className="muted">{resume.contact.join(" | ")}</div>
      {resume.summary && (<><h2>Summary</h2><p>{resume.summary}</p></>)}
      {resume.skills.length > 0 && (<><h2>Skills</h2><p>{resume.skills.join(", ")}</p></>)}
      {resume.experience.length > 0 && <h2>Experience</h2>}
      {resume.experience.map((job, i) => (
        <div key={i}>
          <h4>{job.title}{job.company && `, ${job.company}`}{job.dates && <span className="muted"> ({job.dates})</span>}</h4>
          <ul>{job.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>
        </div>
      ))}
      {resume.education.length > 0 && (<><h2>Education</h2><ul>{resume.education.map((e, i) => <li key={i}>{e}</li>)}</ul></>)}
      {resume.additional.map((a, i) => (<div key={i}><h2>{a.heading}</h2><ul>{a.lines.map((l, j) => <li key={j}>{l}</li>)}</ul></div>))}
    </div>
  );
}
