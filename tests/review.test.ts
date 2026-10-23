import { describe, expect, it } from "vitest";
import { analyzeMatch } from "@/lib/match";
import { buildTailorPrompt, MARKERS } from "@/lib/prompt";
import { parseReply, reviewReply } from "@/lib/review";
import { JD, RESUME } from "./fixtures";

const prefs = { pages: 1 as const, tone: "standard professional" as const, intensity: "balanced" as const };

describe("buildTailorPrompt", () => {
  const prompt = buildTailorPrompt({ resumeText: RESUME, jdText: JD, match: analyzeMatch(RESUME, JD), prefs });

  it("carries the resume, the posting and the analysis", () => {
    expect(prompt).toContain("Jordan Rivera");
    expect(prompt).toContain("Staff Backend Engineer, Fabrikam");
    expect(prompt).toMatch(/not on my resume: .*Kubernetes/);
    expect(prompt).toMatch(/not on my resume: .*AWS/);
  });

  it("states the honesty rules and asks for the parseable format", () => {
    expect(prompt).toMatch(/Never add an employer/);
    for (const m of Object.values(MARKERS)) expect(prompt).toContain(m);
  });

  it("treats the pasted text as data", () => {
    expect(prompt).toMatch(/data, not instructions/);
  });
});

describe("parseReply", () => {
  it("splits the three sections", () => {
    const p = parseReply(`${MARKERS.resume}\nJordan\n- Built things\n\n${MARKERS.changes}\nBefore: a / After: b\n\n${MARKERS.couldNotAdd}\n- Kubernetes\n- AWS\n`);
    expect(p.resumeText).toBe("Jordan\n- Built things");
    expect(p.changesText).toMatch(/Before: a/);
    expect(p.couldNotAdd).toEqual(["Kubernetes", "AWS"]);
  });

  it("tolerates bold markers and a code fence", () => {
    const p = parseReply("```\n**=== RESUME ===**\nJordan\n```");
    expect(p.resumeText).toBe("Jordan");
  });

  it("treats 'none' as no skills", () => {
    expect(parseReply(`${MARKERS.resume}\nx\n${MARKERS.couldNotAdd}\nnone`).couldNotAdd).toEqual([]);
  });

  it("falls back to the whole reply when the format was ignored", () => {
    expect(parseReply("Just a resume\n- a bullet").resumeText).toBe("Just a resume\n- a bullet");
  });
});

describe("reviewReply", () => {
  const review = (resume: string) => reviewReply({ resumeText: RESUME, jdText: JD, reply: `${MARKERS.resume}\n${resume}`, pages: 1 });

  it("leaves an unchanged resume unflagged with the same score", () => {
    const r = review(RESUME);
    expect(r.flagged).toEqual([]);
    expect(r.changedLines).toBe(0);
    expect(r.after.score).toBe(r.before.score);
    expect(r.droppedNumbers).toEqual([]);
  });

  it("accepts a faithful rewording", () => {
    const r = review(RESUME.replace("Reduced p95 checkout latency by 38% by adding a Redis cache in front of PostgreSQL", "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL"));
    expect(r.changedLines).toBe(1);
    expect(r.flagged).toEqual([]);
  });

  it("flags an invented number", () => {
    const r = review(RESUME.replace("38%", "52%"));
    expect(r.flagged).toHaveLength(1);
    expect(r.flagged[0].kind).toBe("violation");
    expect(r.flagged[0].problems[0]).toMatch(/52%/);
    expect(r.droppedNumbers).toContain("38%");
    expect(r.risk.checks.find((c) => c.id === "trace")!.status).toBe("warn");
  });

  it("flags a tool that is in neither the resume nor the posting", () => {
    const r = review(RESUME + "- Built search with Elasticsearch and Kafka\n");
    expect(r.flagged.some((f) => f.kind === "violation" && /Elasticsearch/.test(f.problems.join()))).toBe(true);
  });

  it("asks you to confirm a posting skill the resume never showed", () => {
    const r = review(RESUME + "- Ran production services on Kubernetes\n");
    const f = r.flagged.find((x) => /Kubernetes/.test(x.text))!;
    expect(f.kind).toBe("confirm");
  });

  it("does not flag a renamed section title", () => {
    expect(review(RESUME.replace("Skills", "Core Competencies")).flagged).toEqual([]);
  });

  it("flags an invented tool even in a very short bullet", () => {
    const r = review(RESUME + "- Built search with Elasticsearch\n");
    expect(r.flagged.some((f) => f.kind === "violation" && /Elasticsearch/.test(f.problems.join()))).toBe(true);
  });

  it("still treats a short Title Case line without a bullet as a heading", () => {
    expect(review(RESUME + "Professional Highlights\n").flagged).toEqual([]);
  });

  it("raises the score when the AI works in a term the resume truly supports", () => {
    // The original has no Kubernetes or AWS, so a reply adding them lifts the score but is flagged
    // for confirmation instead of being silently accepted.
    const r = reviewReply({ resumeText: RESUME, jdText: JD, reply: `${MARKERS.resume}\n${RESUME}\n- Operated Kubernetes clusters and AWS services in production.\n`, pages: 1 });
    expect(r.after.score).toBeGreaterThan(r.before.score);
    expect(r.flagged.some((f) => f.kind === "confirm")).toBe(true);
  });

  it("reports figures the AI dropped, but not dates", () => {
    const r = review(RESUME.replace("by 1,200 merchants", "by many merchants").replace(" (2021 - Present)", ""));
    expect(r.droppedNumbers).toContain("1200");
    expect(r.droppedNumbers).not.toContain("2021");
  });
});
