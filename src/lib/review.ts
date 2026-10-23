import { checkGrounding, numbersIn } from "./grounding";
import { analyzeMatch, type MatchResult } from "./match";
import { runRiskCheck, type RiskReport } from "./risk";
import { BULLET_RE } from "./text";

export interface ParsedReply {
  resumeText: string;
  changesText: string;
  /** Posting skills the AI says your resume does not show. */
  couldNotAdd: string[];
}

export interface FlaggedLine {
  text: string;
  /** violation = adds something your resume does not support. confirm = from the posting; keep only if true. */
  kind: "violation" | "confirm";
  problems: string[];
}

export interface Review {
  parsed: ParsedReply;
  before: MatchResult;
  after: MatchResult;
  flagged: FlaggedLine[];
  /** Lines in the reply that are not word-for-word in your original. */
  changedLines: number;
  /** Figures from your original that the reply left out (percentages, money, counts). */
  droppedNumbers: string[];
  risk: RiskReport;
}

// "=== RESUME ===" as asked for in the prompt, tolerating bold, headings, quotes and code fences around it.
const MARKER = /^[\s*#>_`-]*={2,}\s*(RESUME|CHANGES|SKILLS I COULD NOT ADD)\s*={2,}[\s*_`]*$/gim;

/**
 * Reads the AI's reply. If it ignored the requested format, the whole reply is treated as the resume,
 * so the check still runs on whatever was pasted.
 */
export function parseReply(reply: string): ParsedReply {
  const text = reply.replace(/\r/g, "").replace(/^\s*```[a-z]*\s*$/gim, "");
  const found: { name: string; start: number; end: number }[] = [];
  MARKER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = MARKER.exec(text))) found.push({ name: m[1].toUpperCase(), start: m.index, end: m.index + m[0].length });

  if (!found.some((f) => f.name === "RESUME")) return { resumeText: text.trim(), changesText: "", couldNotAdd: [] };

  const section = (name: string) => {
    const i = found.findIndex((f) => f.name === name);
    return i < 0 ? "" : text.slice(found[i].end, found[i + 1]?.start ?? text.length).trim();
  };
  const couldNotAdd = section("SKILLS I COULD NOT ADD")
    .split("\n")
    .map((l) => l.replace(BULLET_RE, "").trim())
    .filter((l) => l && !/^none\.?$/i.test(l));
  return { resumeText: section("RESUME"), changesText: section("CHANGES"), couldNotAdd };
}

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

const isYear = (n: string) => /^(19|20)\d{2}$/.test(n);

/**
 * Checks an AI-tailored resume against the original: re-scores it against the posting, flags any
 * line that adds a number or tool the original does not support, notes figures that were dropped,
 * and runs the risk check. This is the part a chat window cannot do for you.
 */
export function reviewReply(input: { resumeText: string; jdText: string; reply: string; pages: 1 | 2 }): Review {
  const { resumeText, jdText, reply, pages } = input;
  const parsed = parseReply(reply);
  const before = analyzeMatch(resumeText, jdText);
  const after = analyzeMatch(parsed.resumeText, jdText);
  const original = collapse(resumeText);

  const flagged: FlaggedLine[] = [];
  let changedLines = 0;
  for (const raw of parsed.resumeText.split("\n")) {
    const line = raw.replace(BULLET_RE, "").replace(/^#+\s*/, "").replace(/\*\*|__/g, "").trim();
    if (line.length < 3 || original.includes(collapse(line))) continue;
    changedLines++;

    // Section titles are often renamed ("Core Competencies"); only numbers matter for those. A heading is
    // short, not a bullet, and written in Title Case or capitals: a short bullet is still a claim.
    const words = line.split(/\s+/);
    const headingLike = !BULLET_RE.test(raw) && words.length <= 4 && !/[.,;]$/.test(line) && !/\d/.test(line) && words.every((w) => /^[A-Z&]/.test(w) || /^(and|of|the|&)$/i.test(w));
    const g = checkGrounding(resumeText, line, jdText);

    const problems: string[] = [];
    if (g.numbers.length) problems.push(`number not in your resume: ${g.numbers.join(", ")}`);
    if (!headingLike && g.invented.length) problems.push(`not in your resume or the posting: ${g.invented.join(", ")}`);
    if (problems.length) flagged.push({ text: line, kind: "violation", problems });
    else if (!headingLike && g.unconfirmed.length) {
      flagged.push({ text: line, kind: "confirm", problems: [`from the posting, not your resume: ${g.unconfirmed.join(", ")}. Keep it only if it is true.`] });
    }
  }

  const kept = new Set(numbersIn(parsed.resumeText));
  const droppedNumbers = [...new Set(numbersIn(resumeText))].filter((n) => !kept.has(n) && !isYear(n) && n.length > 1);

  const risk = runRiskCheck({ resumeText: parsed.resumeText, jdText, matchScore: after.score, pages, untraceableLines: flagged.length });
  return { parsed, before, after, flagged, changedLines, droppedNumbers, risk };
}
