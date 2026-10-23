import { describe, expect, it } from "vitest";
import { extractRequirements } from "@/lib/keywords";
import { analyzeMatch } from "@/lib/match";
import { JD, RESUME } from "./fixtures";

describe("extractRequirements", () => {
  const terms = extractRequirements(JD).map((r) => r.term.toLowerCase());

  it("finds the tools the posting names", () => {
    for (const t of ["node.js", "typescript", "postgresql", "kubernetes", "aws"]) {
      expect(terms).toContain(t);
    }
  });

  it("ignores filler words", () => {
    for (const t of ["experience", "strong", "you", "plus", "years", "end", "every", "familiarity", "5+"]) {
      expect(terms).not.toContain(t);
    }
  });

  it("does not treat a bare number as a skill", () => {
    const found = extractRequirements("Requirements\n- 10+ years building 3 services\n- 2026 roadmap\n");
    expect(found.filter((r) => /\d/.test(r.term))).toEqual([]);
  });

  it("returns nothing for an empty posting", () => {
    expect(extractRequirements("")).toEqual([]);
  });
});

describe("analyzeMatch", () => {
  const result = analyzeMatch(RESUME, JD);

  it("separates what the resume shows from what it lacks", () => {
    const matched = result.matched.map((t) => t.toLowerCase());
    const missing = result.missing.map((t) => t.toLowerCase());
    expect(matched).toEqual(expect.arrayContaining(["node.js", "typescript", "postgresql"]));
    expect(missing).toEqual(expect.arrayContaining(["kubernetes", "aws"]));
  });

  it("scores between 0 and 100 and below 100 when terms are missing", () => {
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("names the posting lines the resume never answers", () => {
    expect(result.unanswered.some((l) => /kubernetes/i.test(l))).toBe(true);
  });

  it("still finds unanswered requirements when the posting has no bullets (pasted or from a PDF)", () => {
    const noBullets = JD.replace(/^- /gm, "");
    const r = analyzeMatch(RESUME, noBullets);
    expect(r.unanswered.some((l) => /kubernetes/i.test(l))).toBe(true);
  });

  it("scores a resume that repeats the posting higher than one that does not", () => {
    const better = analyzeMatch(`${RESUME}\nDeployed services on Kubernetes and AWS.`, JD);
    expect(better.score).toBeGreaterThan(result.score);
  });

  it("matches inflected forms", () => {
    const r = analyzeMatch("I mentored engineers and led design reviews.", "Requirements\n- Mentor engineers\n- Lead design reviews\n");
    expect(r.missing).toEqual([]);
  });
});
