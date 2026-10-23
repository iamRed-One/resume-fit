import type { Resume } from "./schemas";

/** Every editable text unit in the resume, in reading order. */
export function textUnits(r: Resume): { section: "summary" | "skills" | "experience" | "education" | "additional"; text: string }[] {
  const units: { section: "summary" | "skills" | "experience" | "education" | "additional"; text: string }[] = [];
  if (r.summary) units.push({ section: "summary", text: r.summary });
  for (const s of r.skills) units.push({ section: "skills", text: s });
  for (const job of r.experience) for (const b of job.bullets) units.push({ section: "experience", text: b });
  for (const e of r.education) units.push({ section: "education", text: e });
  for (const a of r.additional) for (const l of a.lines) units.push({ section: "additional", text: l });
  return units;
}

/** Replaces the first exact occurrence of `from` with `to`. Returns false when `from` is not present. */
export function replaceUnit(r: Resume, from: string, to: string): boolean {
  const f = from.trim();
  if (r.summary.trim() === f) {
    r.summary = to;
    return true;
  }
  const si = r.skills.findIndex((s) => s.trim() === f);
  if (si >= 0) {
    r.skills[si] = to;
    return true;
  }
  for (const job of r.experience) {
    const bi = job.bullets.findIndex((b) => b.trim() === f);
    if (bi >= 0) {
      job.bullets[bi] = to;
      return true;
    }
  }
  const ei = r.education.findIndex((e) => e.trim() === f);
  if (ei >= 0) {
    r.education[ei] = to;
    return true;
  }
  for (const a of r.additional) {
    const li = a.lines.findIndex((l) => l.trim() === f);
    if (li >= 0) {
      a.lines[li] = to;
      return true;
    }
  }
  return false;
}

export function toPlainText(r: Resume): string {
  const out: string[] = [];
  if (r.name) out.push(r.name.toUpperCase());
  if (r.contact.length) out.push(r.contact.join(" | "));
  if (r.summary) out.push("", "SUMMARY", r.summary);
  if (r.skills.length) out.push("", "SKILLS", r.skills.join(", "));
  if (r.experience.length) {
    out.push("", "EXPERIENCE");
    for (const job of r.experience) {
      out.push(`${job.title}${job.company ? `, ${job.company}` : ""}${job.dates ? ` (${job.dates})` : ""}`);
      for (const b of job.bullets) out.push(`- ${b}`);
      out.push("");
    }
    out.pop();
  }
  if (r.education.length) out.push("", "EDUCATION", ...r.education);
  for (const a of r.additional) out.push("", a.heading.toUpperCase(), ...a.lines.map((l) => `- ${l}`));
  return out.join("\n").trim() + "\n";
}

export function toMarkdown(r: Resume): string {
  const out: string[] = [];
  if (r.name) out.push(`# ${r.name}`);
  if (r.contact.length) out.push(r.contact.join(" | "));
  if (r.summary) out.push("", "## Summary", r.summary);
  if (r.skills.length) out.push("", "## Skills", r.skills.join(", "));
  if (r.experience.length) {
    out.push("", "## Experience");
    for (const job of r.experience) {
      out.push("", `### ${job.title}${job.company ? `, ${job.company}` : ""}`);
      if (job.dates) out.push(`*${job.dates}*`);
      for (const b of job.bullets) out.push(`- ${b}`);
    }
  }
  if (r.education.length) out.push("", "## Education", ...r.education.map((e) => `- ${e}`));
  for (const a of r.additional) out.push("", `## ${a.heading}`, ...a.lines.map((l) => `- ${l}`));
  return out.join("\n").trim() + "\n";
}
