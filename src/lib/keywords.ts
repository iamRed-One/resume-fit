import { SKILLS, type Domain, type Skill, type SkillAlt } from "./skills";
import { GENERIC, STOPWORDS, countAlt, segments, tokenize, type Token } from "./text";

export interface Requirement {
  /** Display form: the dictionary name when known, else the phrase as written. */
  term: string;
  /** Primary stem sequence. */
  stems: string[];
  /** Every spelling that satisfies this requirement (aliases for dictionary skills). */
  alts: SkillAlt[];
  weight: number;
}

type Section = "required" | "preferred" | "responsibilities" | "other" | "general";

const SECTION_WEIGHT: Record<Section, number> = { required: 1.6, responsibilities: 1.0, general: 0.8, preferred: 0.6, other: 0 };

// Order matters: "Preferred qualifications" must be read as preferred, not required.
const PREFERRED_HEADING = /(preferred|nice[- ]to[- ]have|bonus|added plus|plus if|not required|a plus\b)/i;
const REQUIRED_HEADING =
  /(requirements?|qualifications?|must[- ]haves?|what you(?:'ll| will)? (?:need|bring)|what we(?:'re| are) looking for|who you are|about you|you have|your expertise|do you have|desirable skills|skills (?:and|&) experience|minimum|you'll bring|ideal candidate|you should have|technologies used|role requirements)/i;
const RESPONSIBILITIES_HEADING =
  /(responsibilit|what you(?:'ll| will)? (?:do|achieve|work on|own)|a day in the life|role description|about the (?:role|job|position)|^the role\b|your impact|in this role|day to day|key duties|^overview\b|role summary|a typical day|as a .* you will)/i;
const OTHER_HEADING =
  /(^about (?:us|the company|the team|[A-Z][\w.]+$)|who we are|our (?:mission|culture|values|story|approach)|why (?:join|work)|what we offer|what we'll offer|benefits|perks|compensation|pay (?:transparency|range)|annual base salary|salary|total rewards|equal opportunity|uses ai|^ai at|application limit|accommodation|privacy|diversity|life at|community you|difference you|zone [a-z]$|hybrid|location|available locations)/i;

const BOILERPLATE =
  /(equal opportunity|equal employment|reasonable accommodation|accommodations? (?:during|for|in the)|veteran|disabilit|protected (?:class|status|characteristic)|sexual orientation|gender identity|\bsalary\b|pay range|base pay|\b(?:usd|cad|gbp|eur)\b|\$\d[\d,]{4,}|401\(?k\)?|health insurance|paid time off|parental leave|privacy (?:policy|notice|statement)|candidates may submit|background check|export (?:control|law)|sponsorship|total rewards|\bgdpr\b|data protection|recruiting scams?|applicants? (?:may|will|must|should|are)|apply(?:ing)? (?:now|today|here)|please (?:note|review|visit)|click here|generative ai responsibly|ai responsibly|human oversight)/i;

const TECH_LIST = /^\s*[-*•]?\s*(languages?|frameworks?|datastores?|databases?|tools?|technologies|stack|tech stack|infrastructure|platforms?)\s*:/i;

const WEB_ADDRESS = /\.(com|org|net|io|ai|co|dev|app)$/i;
const MAX_REQUIREMENTS = 30;
const MAX_PHRASES = 5;

function isTechLike(t: Token): boolean {
  if (WEB_ADDRESS.test(t.raw)) return false;
  return (
    /[0-9+#]/.test(t.raw) ||
    t.raw.includes(".") ||
    /^[A-Z]{2,6}$/.test(t.raw) ||
    /^[a-z]+[A-Z][A-Za-z]*$/.test(t.raw) ||
    /^[A-Z][a-z]+[A-Z][A-Za-z]*$/.test(t.raw)
  );
}

function usable(t: Token): boolean {
  return t.lower.length >= 2 && !STOPWORDS.has(t.lower) && !GENERIC.has(t.lower) && !/^\d/.test(t.lower);
}

/** A line that stands alone as a heading rather than a sentence or bullet. */
function isHeading(line: string): boolean {
  if (/^\s*[-*•]/.test(line)) return false;
  const words = line.trim().split(/\s+/).length;
  return line.length < 80 && words <= 10 && /[A-Za-z]/.test(line) && !/[.!?]$/.test(line.trim());
}

function classify(heading: string): Section | null {
  if (PREFERRED_HEADING.test(heading)) return "preferred";
  if (REQUIRED_HEADING.test(heading)) return "required";
  if (RESPONSIBILITIES_HEADING.test(heading)) return "responsibilities";
  if (OTHER_HEADING.test(heading)) return "other";
  return null;
}

interface Line {
  text: string;
  tokens: Token[];
  weight: number;
  /** A "Languages: Go, Python" style line: its items are all skills. */
  techList: boolean;
}

/**
 * Splits a posting into scored lines. Boilerplate (equal-opportunity text, pay, benefits, company
 * blurbs) is dropped and its capitalised words remembered, so a company name that appears there is
 * not mistaken for a skill elsewhere.
 */
function readPosting(jd: string): { lines: Line[]; ignored: Map<string, number> } {
  // Some postings put the bullet marker alone on one line and the text on the next.
  const normalised = jd.replace(/^\s*[-*•]\s*\n+\s*/gm, "- ");
  const lines: Line[] = [];
  const ignored = new Map<string, number>();
  let section: Section = "general";

  const remember = (text: string) => {
    for (const t of tokenize(text)) if (/^[A-Z]/.test(t.raw) && t.lower.length > 2) ignored.set(t.stem, (ignored.get(t.stem) ?? 0) + 1);
  };

  for (const raw of normalised.split(/\r?\n/)) {
    const text = raw.replace(/^\s*([-*•·–]|\d+[.)])\s+/, "").trim();
    if (!text) continue;

    if (isHeading(raw)) {
      const next = classify(text);
      if (next) section = next;
      if (next === "other") {
        remember(text);
        continue;
      }
      // A sentence-like "heading" ("As a Senior Staff Engineer, Payments you will:") carries content.
      if (!/[,]/.test(text) && text.split(/\s+/).length < 7) continue;
    }

    if (section === "other" || BOILERPLATE.test(text)) {
      remember(text);
      continue;
    }

    const techList = TECH_LIST.test(raw);
    const weight = techList ? SECTION_WEIGHT.required : SECTION_WEIGHT[section];
    lines.push({ text, tokens: tokenize(text), weight, techList });
  }
  return { lines, ignored };
}

/**
 * Deterministic requirement extraction.
 *  1. Dictionary skills (lib/skills.ts) are found by alias wherever they appear, weighted by the
 *     section they sit in, so a tool named once in "Requirements" still counts.
 *  2. A few phrases outside the dictionary are kept when they look like terms of art.
 */
export function extractRequirements(jd: string): Requirement[] {
  const { lines, ignored } = readPosting(jd);

  const hits: { skill: Skill; occurrences: number; score: number }[] = [];
  for (const skill of SKILLS) {
    let score = 0;
    let occurrences = 0;
    for (const line of lines) {
      const n = Math.max(...skill.alts.map((a) => countAlt(line.tokens, a)));
      if (n > 0) {
        occurrences += n;
        score += n * line.weight;
      }
    }
    if (occurrences > 0) hits.push({ skill, occurrences, score });
  }

  // Which field is this posting in? Decided by its unambiguous skills only.
  const fieldScore = new Map<Domain, number>();
  for (const h of hits) {
    if (h.skill.weak) continue;
    for (const d of h.skill.domains) if (d !== "general") fieldScore.set(d, (fieldScore.get(d) ?? 0) + Math.min(h.score, 6));
  }
  const field = [...fieldScore.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];

  const found: Requirement[] = [];
  const coveredRuns: string[][] = [];
  for (const { skill, occurrences, score } of hits) {
    // "pipeline", "search" or "discovery" are skills only in their own field, unless repeated.
    if (skill.weak && occurrences < 3 && !skill.domains.some((d) => d === "general" || d === field)) continue;
    // A tool name that is also repeated in the boilerplate is the employer ("About Datadog"), not a skill.
    if (skill.alts[0].stems.length === 1 && (ignored.get(skill.alts[0].stems[0]) ?? 0) >= 2 && occurrences <= 2) continue;
    // Soft, every-field terms ("cross-functional", "mentoring") say little about fit: they rank below tools.
    const soft = skill.domains.includes("general");
    found.push({
      term: skill.display,
      stems: skill.alts[0].stems,
      alts: skill.alts,
      weight: soft ? 1.2 + Math.min(score, 3) * 0.3 : 3 + Math.min(score, 6),
    });
    for (const a of skill.alts) coveredRuns.push(a.stems);
  }

  found.push(...listedTools(lines, ignored, coveredRuns));
  found.push(...phrasesOutsideDictionary(lines, ignored, coveredRuns));

  return found.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term)).slice(0, MAX_REQUIREMENTS);
}

function phrasesOutsideDictionary(lines: Line[], ignored: Map<string, number>, covered: string[][]): Requirement[] {
  interface Cand {
    tokens: Token[];
    count: number;
    score: number;
  }
  const cands = new Map<string, Cand>();

  for (const line of lines) {
    if (line.weight < SECTION_WEIGHT.responsibilities) continue;
    for (const seg of segments(line.text)) {
      const tokens = tokenize(seg);
      for (let n = 1; n <= 3; n++) {
        for (let i = 0; i + n <= tokens.length; i++) {
          const window = tokens.slice(i, i + n);
          if (!window.every(usable) || window.some((t) => ignored.has(t.stem))) continue;
          const key = window.map((t) => t.stem).join(" ");
          const c = cands.get(key) ?? { tokens: window, count: 0, score: 0 };
          c.count += 1;
          c.score += line.weight;
          cands.set(key, c);
        }
      }
    }
  }

  const out: Requirement[] = [];
  for (const [key, c] of cands) {
    const stems = key.split(" ");
    const tech = c.tokens.some(isTechLike) && !c.tokens.some((t) => /^[A-Z]{2}$/.test(t.raw));
    const keep = c.tokens.length === 1 ? tech && c.count >= 1 : c.count >= 2;
    if (!keep) continue;
    if (covered.some((run) => run.length > 0 && containsRun(stems, run))) continue;
    out.push({
      term: c.tokens.map((t) => (isTechLike(t) ? t.raw : t.lower)).join(" "),
      stems,
      alts: [{ stems }],
      weight: 1 + Math.min(c.score, 3) + (tech ? 1 : 0),
    });
  }
  return out.sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term)).slice(0, MAX_PHRASES);
}

const LIST_LEAD = /(?:such as|e\.g\.,?|i\.e\.,?|including|\()\s*([^.;()]{3,160})/gi;
const MAX_LISTED = 8;

/**
 * Tools the dictionary does not know, found where postings name them: "(e.g., Ruby, Go, Flink)",
 * "such as Spark, Kafka or Airflow", "Languages: Go, Python". Items must look like names (capitalised
 * or tech-like) and sit in a list of at least two such names.
 */
function listedTools(lines: Line[], ignored: Map<string, number>, covered: string[][]): Requirement[] {
  const out = new Map<string, Requirement>();
  for (const line of lines) {
    const spans: string[] = [];
    if (line.techList) spans.push(line.text.slice(line.text.indexOf(":") + 1));
    LIST_LEAD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LIST_LEAD.exec(line.text))) spans.push(m[1]);

    for (const span of spans) {
      const items = span
        .split(/,|\/|\bor\b|\band\b/i)
        .map((x) => x.replace(/\b(etc|others|similar|preferred|plus)\b/gi, "").trim())
        .filter(Boolean)
        .map((x) => tokenize(x))
        .filter((t) => t.length >= 1 && t.length <= 3);
      const names = items.filter((t) => t.every((x) => x.lower.length >= 2 && !STOPWORDS.has(x.lower) && !GENERIC.has(x.lower)) && (isTechLike(t[0]) || /^[A-Z]/.test(t[0].raw)));
      if (names.length < 2) continue;
      const known = (t: Token[]) => covered.some((run) => run.length === t.length && run.every((s, i) => s === t[i].stem));
      if (!names.some((t) => isTechLike(t[0]) || known(t))) continue;
      for (const t of names) {
        const stems = t.map((x) => x.stem);
        if (t.some((x) => ignored.has(x.stem))) continue;
        if (covered.some((run) => run.length > 0 && (containsRun(stems, run) || containsRun(run, stems)))) continue;
        if (stems.length === 1 && /^[A-Z]{2}$/.test(t[0].raw)) continue;
        const key = stems.join(" ");
        if (!out.has(key)) out.set(key, { term: t.map((x) => x.raw).join(" "), stems, alts: [{ stems }], weight: 2 });
      }
    }
  }
  return [...out.values()].sort((a, b) => a.term.localeCompare(b.term)).slice(0, MAX_LISTED);
}

function containsRun(haystack: string[], needle: string[]): boolean {
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((s, j) => haystack[i + j] === s)) return true;
  }
  return false;
}
