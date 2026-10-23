import { describe, expect, it } from "vitest";
import type { Resume, TailorModelOutput } from "@/lib/schemas";
import { tailorResume, writeCoverLetter, type Model } from "@/lib/tailor";
import { JD, RESUME } from "./fixtures";

const LATENCY = "Reduced p95 checkout latency by 38% by adding a Redis cache in front of PostgreSQL";
const LED = "Led a team of 4 engineers building the invoicing API used by 1,200 merchants";

function baseResume(): Resume {
  return {
    name: "Jordan Rivera",
    contact: ["jordan.rivera@example.com"],
    summary: "Backend engineer with six years building payment APIs.",
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Docker"],
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Northwind Payments",
        dates: "2021 - Present",
        bullets: [LED, LATENCY, "Wrote integration tests and ran code reviews for the payments squad"],
      },
    ],
    education: ["B.Sc. Computer Science, University of Waterloo, 2018"],
    additional: [],
  };
}

function fakeModel(out: TailorModelOutput, letter = "Dear [Hiring Manager], I led 4 engineers."): Model {
  return { tailor: async () => out, text: async () => letter };
}

const prefs = { pages: 1 as const, tone: "standard professional" as const, intensity: "balanced" as const };

describe("tailorResume", () => {
  it("keeps a faithful edit and records why", async () => {
    const after = "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL";
    const r = baseResume();
    r.experience[0].bullets[1] = after;
    const result = await tailorResume(
      { resumeText: RESUME, jdText: JD, prefs },
      fakeModel({
        resume: r,
        changeLog: [{ section: "experience", before: LATENCY, after, requirement: "query tuning", reason: "Leads with the result." }],
        suggestedSkills: [],
      }),
    );
    expect(result.changeLog[0].status).toBe("applied");
    expect(result.resume.experience[0].bullets[1]).toBe(after);
    expect(result.flagged).toBe(0);
  });

  it("reverts an edit that invents a number and puts the original wording back", async () => {
    const invented = "Reduced p95 checkout latency by 52% by adding a Redis cache in front of PostgreSQL";
    const r = baseResume();
    r.experience[0].bullets[1] = invented;
    const result = await tailorResume(
      { resumeText: RESUME, jdText: JD, prefs },
      fakeModel({
        resume: r,
        changeLog: [{ section: "experience", before: LATENCY, after: invented, requirement: "query tuning", reason: "Stronger." }],
        suggestedSkills: [],
      }),
    );
    expect(result.changeLog[0].status).toBe("reverted");
    expect(result.changeLog[0].note).toMatch(/52%/);
    expect(result.resume.experience[0].bullets[1]).toBe(LATENCY);
    expect(result.flagged).toBe(1);
  });

  it("holds back a posting-only term for the user to confirm", async () => {
    const after = "Led 4 engineers shipping the invoicing API on Kubernetes for 1,200 merchants";
    const r = baseResume();
    r.experience[0].bullets[0] = after;
    const result = await tailorResume(
      { resumeText: RESUME, jdText: JD, prefs },
      fakeModel({
        resume: r,
        changeLog: [{ section: "experience", before: LED, after, requirement: "Kubernetes", reason: "Matches the stack." }],
        suggestedSkills: [],
      }),
    );
    expect(result.changeLog[0].status).toBe("needs-review");
    expect(result.changeLog[0].note).toMatch(/Kubernetes/);
  });

  it("flags a quoted original that is not in the resume", async () => {
    const result = await tailorResume(
      { resumeText: RESUME, jdText: JD, prefs },
      fakeModel({
        resume: baseResume(),
        changeLog: [{ section: "summary", before: "Staff engineer with ten years", after: "Backend engineer", requirement: "r", reason: "x" }],
        suggestedSkills: [],
      }),
    );
    expect(result.changeLog[0].status).toBe("needs-review");
    expect(result.changeLog[0].note).toMatch(/not found/);
  });

  it("warns about an unlogged line that adds unsupported facts", async () => {
    const r = baseResume();
    r.experience[0].bullets.push("Cut infrastructure spend by 61% with Terraform");
    const result = await tailorResume({ resumeText: RESUME, jdText: JD, prefs }, fakeModel({ resume: r, changeLog: [], suggestedSkills: [] }));
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].problems[0]).toMatch(/61%/);
    expect(result.flagged).toBe(1);
  });

  it("keeps only suggested skills that the posting names and the resume lacks", async () => {
    const result = await tailorResume(
      { resumeText: RESUME, jdText: JD, prefs },
      fakeModel({ resume: baseResume(), changeLog: [], suggestedSkills: ["Kubernetes", "AWS", "TypeScript", "Rust", "  "] }),
    );
    expect(result.suggestedSkills.sort()).toEqual(["AWS", "Kubernetes"]);
  });
});

describe("writeCoverLetter", () => {
  it("reports when the letter adds a number the resume does not contain", async () => {
    const letter = await writeCoverLetter(
      { resume: baseResume(), jdText: JD },
      fakeModel({ resume: baseResume(), changeLog: [], suggestedSkills: [] }, "I grew revenue 300% at my last role."),
    );
    expect(letter.grounding.ok).toBe(false);
    expect(letter.grounding.numbers).toContain("300%");
  });

  it("passes a letter that stays within the resume", async () => {
    const letter = await writeCoverLetter(
      { resume: baseResume(), jdText: JD },
      fakeModel({ resume: baseResume(), changeLog: [], suggestedSkills: [] }, "I led a team of 4 engineers."),
    );
    expect(letter.grounding.ok).toBe(true);
  });
});
