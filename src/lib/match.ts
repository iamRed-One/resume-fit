import { extractRequirements, type Requirement } from "./keywords";
import { countAlt, isBullet, tokenize, type Token } from "./text";

export interface MatchResult {
  /** 0-100, weighted share of the posting's requirement terms the resume shows. */
  score: number;
  requirements: Requirement[];
  matched: string[];
  missing: string[];
  /** Posting lines whose requirement terms the resume never mentions, most important first. */
  unanswered: string[];
}

/** True when the tokens contain the requirement under any of its aliases. */
export function shows(tokens: Token[], requirement: Requirement): boolean {
  return requirement.alts.some((alt) => countAlt(tokens, alt) > 0);
}

export function analyzeMatch(resumeText: string, jdText: string): MatchResult {
  const requirements = extractRequirements(jdText);
  const resumeTokens = tokenize(resumeText);

  const matched: Requirement[] = [];
  const missing: Requirement[] = [];
  for (const r of requirements) (shows(resumeTokens, r) ? matched : missing).push(r);

  const total = requirements.reduce((s, r) => s + r.weight, 0);
  const got = matched.reduce((s, r) => s + r.weight, 0);
  const score = total === 0 ? 0 : Math.round((got / total) * 100);

  return {
    score,
    requirements,
    matched: matched.map((r) => r.term),
    missing: missing.map((r) => r.term),
    unanswered: unansweredLines(jdText, requirements, new Set(matched.map((r) => r.term))),
  };
}

/**
 * The posting's requirement lines: its bullets, or, when it has none (text pasted from a web page or
 * extracted from a PDF usually loses them), its sentence-length lines.
 */
function candidateLines(jd: string): string[] {
  const lines = jd.split(/\r?\n/);
  const bullets = lines.filter(isBullet);
  if (bullets.length >= 2) {
    return bullets.map((l) => l.replace(/^\s*([-*•·–]|\d+[.)])\s+/, "").trim()).filter((l) => l.length >= 15);
  }
  return lines.map((l) => l.trim()).filter((l) => l.length >= 30 && l.split(/\s+/).length >= 6);
}

function unansweredLines(jd: string, requirements: Requirement[], matchedTerms: Set<string>): string[] {
  const rows: { line: string; weight: number }[] = [];
  for (const line of candidateLines(jd)) {
    const lineTokens = tokenize(line);
    const hits = requirements.filter((r) => shows(lineTokens, r));
    if (hits.length === 0) continue;
    if (hits.some((h) => matchedTerms.has(h.term))) continue;
    rows.push({ line: line.length > 160 ? line.slice(0, 157) + "..." : line, weight: hits.reduce((s, h) => s + h.weight, 0) });
  }
  return rows.sort((a, b) => b.weight - a.weight).slice(0, 5).map((r) => r.line);
}
