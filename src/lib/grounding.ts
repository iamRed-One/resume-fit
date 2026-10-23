import { SKILLS } from "./skills";
import { countAlt, tokenize } from "./text";

export interface GroundingReport {
  /** Numbers in the rewrite that appear nowhere in the source resume. Always a violation. */
  numbers: string[];
  /** Proper-noun or tool-like terms that are in neither the resume nor the posting. A violation. */
  invented: string[];
  /** Terms that are in the posting but not the resume: allowed in the text only after the user confirms. */
  unconfirmed: string[];
  ok: boolean;
}

// A figure, not a digit inside a name: "52%", "$2.5M", "1,200", "10x" count; the 8 in "K8s", the 2 in "EC2" or
// "B2B", and the 3 in "3D" do not. (Otherwise rewriting "Kubernetes" as "K8s" would look like an invented number.)
const NUMBER_RE = /(?<![A-Za-z0-9_])\$?\d[\d,]*(?:\.\d+)?(?:\s?(?:%|k\b|m\b|bn\b|x\b|\+)|(?:st|nd|rd|th)\b)?(?![A-Za-z0-9])/gi;

function normNumber(n: string): string {
  return n.replace(/[\s,]/g, "").toLowerCase();
}

export function numbersIn(text: string): string[] {
  return (text.match(NUMBER_RE) ?? []).map(normNumber).filter((n) => /\d/.test(n));
}

function isProperish(raw: string, index: number): boolean {
  if (/[0-9+#]/.test(raw) || raw.includes(".")) return true;
  if (/^[A-Z]{2,6}$/.test(raw)) return true;
  if (/^[A-Z][a-z]+[A-Z]/.test(raw) || /^[a-z]+[A-Z]/.test(raw)) return true;
  // A capitalised word that is not the first word of the text.
  return index > 0 && /^[A-Z][a-z]{2,}$/.test(raw);
}

/**
 * Checks one rewritten line against the resume it was derived from. Rewording is fine;
 * new numbers, employers, tools or credentials are not.
 */
export function checkGrounding(source: string, rewrite: string, posting = ""): GroundingReport {
  const sourceNumbers = new Set(numbersIn(source));
  const numbers = [...new Set(numbersIn(rewrite).filter((n) => !sourceNumbers.has(n)))];

  const sourceTokens = tokenize(source);
  const sourceTerms = new Set(sourceTokens.map((t) => t.lower));
  const postingTerms = new Set(tokenize(posting).map((t) => t.lower));

  // "k8s" -> "Kubernetes" or "Postgres" -> "PostgreSQL" is the same skill, not a new one.
  const sameSkillInSource = (stem: string) =>
    SKILLS.some((s) => s.alts.some((a) => a.stems.length === 1 && a.stems[0] === stem) && s.alts.some((a) => countAlt(sourceTokens, a) > 0));

  const invented = new Set<string>();
  const unconfirmed = new Set<string>();
  tokenize(rewrite).forEach((t, i) => {
    if (!isProperish(t.raw, i) || /^\d/.test(t.raw)) return;
    if (sourceTerms.has(t.lower) || sameSkillInSource(t.stem)) return;
    (postingTerms.has(t.lower) ? unconfirmed : invented).add(t.raw);
  });

  return {
    numbers,
    invented: [...invented],
    unconfirmed: [...unconfirmed],
    ok: numbers.length === 0 && invented.size === 0,
  };
}
