import { readFileSync } from "node:fs";
import path from "node:path";
import { checkGrounding } from "@/lib/grounding";
import { analyzeMatch } from "@/lib/match";
import { toPlainText } from "@/lib/resume";
import type { Prefs } from "@/lib/schemas";
import { tailorResume, type Model } from "@/lib/tailor";

export interface Pair {
  resume: string;
  posting: string;
  expect: "good" | "partial" | "poor";
}

export interface PairResult {
  resume: string;
  posting: string;
  expect: Pair["expect"];
  scoreBefore: number;
  scoreAfter: number;
  changes: { total: number; applied: number; reverted: number; needsReview: number };
  /** Unlogged lines that add unsupported facts. */
  warnings: number;
  suggestedSkills: number;
  /** Numbers in the final resume that appear nowhere in the original. Should always be 0. */
  newNumbers: string[];
  /** Names or tools in the final resume that are in neither the original nor the posting. Should be 0. */
  inventedTerms: string[];
  /** A poor-fit pair whose score jumped: a sign the tool is papering over a real gap. */
  suspiciousLift: boolean;
  ms: number;
}

const DATA = path.join(import.meta.dirname, "data");
const SUSPICIOUS_LIFT = 25;

export function loadPairs(): Pair[] {
  return (JSON.parse(readFileSync(path.join(DATA, "pairs.json"), "utf8")) as { pairs: Pair[] }).pairs;
}

export function loadPair(pair: Pair): { resumeText: string; jdText: string } {
  const resumeText = readFileSync(path.join(DATA, "resumes", `${pair.resume}.txt`), "utf8");
  // Posting snapshots start with a 6-line header (title, company, group, source, fetched, blank).
  const jdText = readFileSync(path.join(DATA, pair.posting), "utf8").split("\n").slice(6).join("\n");
  return { resumeText, jdText };
}

export async function runPair(pair: Pair, model: Model, prefs: Prefs): Promise<PairResult> {
  const { resumeText, jdText } = loadPair(pair);
  const started = Date.now();
  const before = analyzeMatch(resumeText, jdText);
  const result = await tailorResume({ resumeText, jdText, prefs }, model);
  const finalText = toPlainText(result.resume);
  const after = analyzeMatch(finalText, jdText);

  // An independent check over the WHOLE final resume, not just the logged edits.
  const whole = checkGrounding(resumeText, finalText, jdText);
  const count = (s: string) => result.changeLog.filter((c) => c.status === s).length;

  return {
    resume: pair.resume,
    posting: pair.posting,
    expect: pair.expect,
    scoreBefore: before.score,
    scoreAfter: after.score,
    changes: { total: result.changeLog.length, applied: count("applied"), reverted: count("reverted"), needsReview: count("needs-review") },
    warnings: result.warnings.length,
    suggestedSkills: result.suggestedSkills.length,
    newNumbers: whole.numbers,
    inventedTerms: whole.invented,
    suspiciousLift: pair.expect === "poor" && after.score - before.score > SUSPICIOUS_LIFT,
    ms: Date.now() - started,
  };
}

/** USD per million tokens, input / output. Unknown models report tokens only. */
const PRICES: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20],
  "claude-sonnet-5-5": [2, 10],
  "claude-haiku-5-5": [0.1, 0.5],
};

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICES[modelId];
  return p ? (inputTokens * p[0] + outputTokens * p[1]) / 1_000_000 : null;
}

export function formatReport(results: PairResult[], extra: { model: string; calls: number; inputTokens: number; outputTokens: number }): string {
  const cost = estimateCost(extra.model, extra.inputTokens, extra.outputTokens);
  const rows = results.map((r) => {
    const flags = [r.newNumbers.length ? `NEW NUMBERS ${r.newNumbers.join(",")}` : "", r.inventedTerms.length ? `INVENTED ${r.inventedTerms.join(",")}` : "", r.suspiciousLift ? "SUSPICIOUS LIFT" : ""].filter(Boolean);
    return [
      `${r.resume} x ${path.basename(r.posting, ".txt")}  [${r.expect}]`,
      `  score ${r.scoreBefore} -> ${r.scoreAfter}   edits ${r.changes.total} (kept ${r.changes.applied}, reverted ${r.changes.reverted}, needs review ${r.changes.needsReview})   unlogged-unsupported ${r.warnings}   suggested skills ${r.suggestedSkills}   ${(r.ms / 1000).toFixed(0)}s`,
      `  ${flags.length ? flags.join("; ") : "no invented facts in the final resume"}`,
    ].join("\n");
  });
  const clean = results.filter((r) => !r.newNumbers.length && !r.inventedTerms.length && !r.suspiciousLift).length;
  return [
    `Live evaluation: ${results.length} pairs, model ${extra.model}`,
    `Clean (no invented facts, no suspicious lift): ${clean}/${results.length}`,
    `Spent: ${extra.calls} calls, ${extra.inputTokens} input + ${extra.outputTokens} output tokens${cost === null ? "" : `, about $${cost.toFixed(2)}`}`,
    "",
    ...rows,
    "",
  ].join("\n");
}
