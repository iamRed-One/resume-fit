import { describe, expect, it } from "vitest";
import { estimateCost, formatReport, loadPair, loadPairs, runPair } from "../evals/live-core";
import type { TailorModelOutput } from "@/lib/schemas";
import type { Model } from "@/lib/tailor";

// These check the MEASURING code with a fake model. They need evals/data (run
// `node evals/fetch-postings.mjs` first); with no data they are skipped, not failed.
import { existsSync } from "node:fs";
import path from "node:path";
const haveData = existsSync(path.join(import.meta.dirname, "..", "evals", "data", "postings", "swe-backend-3.txt"));

const prefs = { pages: 1 as const, tone: "standard professional" as const, intensity: "balanced" as const };

function passthrough(): Model {
  return {
    tailor: async (req) => {
      // Returns the resume unchanged, parsed crudely from the prompt.
      const resumeText = /<resume>\n([\s\S]*?)\n<\/resume>/.exec(req.user)![1];
      const out: TailorModelOutput = {
        resume: { name: "X", contact: [], summary: "", skills: [], experience: [{ title: "t", company: "c", dates: "", bullets: resumeText.split("\n").filter((l) => l.startsWith("- ")).map((l) => l.slice(2)) }], education: [], additional: [] },
        changeLog: [],
        suggestedSkills: [],
      };
      return out;
    },
    text: async () => "",
  };
}

function inventing(): Model {
  const base = passthrough();
  return {
    ...base,
    tailor: async (req) => {
      const out = await base.tailor(req);
      out.resume.experience[0].bullets.push("Cut cloud spend by 77% using Terraform and Snowflake");
      return out;
    },
  };
}

describe.skipIf(!haveData)("live evaluation core", () => {
  it("loads all pairs with real files behind them", () => {
    const pairs = loadPairs();
    expect(pairs.length).toBeGreaterThanOrEqual(10);
    for (const p of pairs) {
      const { resumeText, jdText } = loadPair(p);
      expect(resumeText.length).toBeGreaterThan(200);
      expect(jdText.length).toBeGreaterThan(500);
    }
  });

  it("reports a faithful model as clean", async () => {
    const r = await runPair(loadPairs()[0], passthrough(), prefs);
    expect(r.newNumbers).toEqual([]);
    expect(r.inventedTerms).toEqual([]);
    expect(r.suspiciousLift).toBe(false);
  });

  it("catches a model that invents a number and a tool", async () => {
    const r = await runPair(loadPairs()[0], inventing(), prefs);
    expect(r.newNumbers).toContain("77%");
    expect(r.inventedTerms.length).toBeGreaterThan(0);
    expect(r.warnings).toBe(1);
    expect(formatReport([r], { model: "claude-opus-5-5", calls: 1, inputTokens: 1000, outputTokens: 500 })).toMatch(/NEW NUMBERS/);
  });
});

describe("estimateCost", () => {
  it("prices known models and declines unknown ones", () => {
    expect(estimateCost("claude-opus-5-5", 1_000_000, 1_000_000)).toBe(24);
    expect(estimateCost("claude-sonnet-5-5", 1_000_000, 0)).toBe(2);
    expect(estimateCost("some-other-model", 10, 10)).toBeNull();
  });
});
