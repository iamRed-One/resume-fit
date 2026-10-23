import { BULLET_RE, isBullet, tokenize, wordCount } from "./text";

export type RiskStatus = "pass" | "warn" | "fail";

export interface RiskCheck {
  id: "keywords" | "impact" | "format" | "leadership" | "length" | "trace";
  label: string;
  status: RiskStatus;
  detail: string;
  /** A concrete next step, shown when the check is not a pass. */
  fix: string | null;
}

export interface RiskReport {
  overall: RiskStatus;
  checks: RiskCheck[];
}

export interface RiskInput {
  resumeText: string;
  jdText: string;
  matchScore: number;
  /** One-page or two-page target; about 550 words per page for a plain single-column resume. */
  pages: 1 | 2;
  /** Number of rewritten lines that still need the user's eyes (reverted or unconfirmed). */
  untraceableLines?: number;
}

const WORDS_PER_PAGE = 550;
const LEADERSHIP_JD = /\b(lead|leader|leadership|manage[sd]?|manager|mentor\w*|head of|director|senior|principal|staff)\b/i;
const LEADERSHIP_VERBS = new Set(
  "led lead leading managed manage managing mentored mentoring coached directed owned drove spearheaded supervised headed oversaw launched established".split(" "),
);
const IMPACT_RE = /(\$\s?\d|\d[\d,.]*\s?(%|k\b|m\b|x\b|\+)|\b\d{2,}\b)/i;

function worst(a: RiskStatus, b: RiskStatus): RiskStatus {
  const rank = { pass: 0, warn: 1, fail: 2 } as const;
  return rank[a] >= rank[b] ? a : b;
}

export function runRiskCheck(input: RiskInput): RiskReport {
  const checks: RiskCheck[] = [
    keywordCheck(input),
    impactCheck(input),
    formatCheck(input),
    leadershipCheck(input),
    lengthCheck(input),
    traceCheck(input),
  ];
  return { overall: checks.reduce<RiskStatus>((acc, c) => worst(acc, c.status), "pass"), checks };
}

function keywordCheck({ matchScore }: RiskInput): RiskCheck {
  const status: RiskStatus = matchScore >= 70 ? "pass" : matchScore >= 45 ? "warn" : "fail";
  return {
    id: "keywords",
    label: "Keyword coverage",
    status,
    detail: `Your resume shows ${matchScore}% of the posting's weighted requirement terms.`,
    fix:
      status === "pass"
        ? null
        : "Work the missing terms into experience you actually have. Add a term only if it is true.",
  };
}

function bulletLines(resumeText: string): string[] {
  const lines = resumeText.split(/\r?\n/);
  const bullets = lines.filter(isBullet).map((l) => l.replace(BULLET_RE, "").trim());
  if (bullets.length > 0) return bullets;
  return lines.map((l) => l.trim()).filter((l) => l.split(/\s+/).length >= 8);
}

function impactCheck({ resumeText }: RiskInput): RiskCheck {
  const bullets = bulletLines(resumeText);
  if (bullets.length === 0) {
    return { id: "impact", label: "Impact clarity", status: "warn", detail: "No bullet points found to assess.", fix: "Use one bullet per accomplishment under each role." };
  }
  const withResult = bullets.filter((b) => IMPACT_RE.test(b)).length;
  const share = withResult / bullets.length;
  const status: RiskStatus = share >= 0.4 ? "pass" : share >= 0.2 ? "warn" : "fail";
  return {
    id: "impact",
    label: "Impact clarity",
    status,
    detail: `${withResult} of ${bullets.length} bullets state a number or measurable result.`,
    fix:
      status === "pass"
        ? null
        : "Add the real figure (count, percent, money, time saved) to your strongest bullets. We never invent one for you.",
  };
}

function formatCheck({ resumeText }: RiskInput): RiskCheck {
  const problems: string[] = [];
  if (!/[\w.+-]+@[\w-]+\.[\w.]+/.test(resumeText)) problems.push("no email address found");
  if (/\t/.test(resumeText) || /\S {4,}\S/.test(resumeText)) problems.push("wide gaps suggest columns or a table");
  if (/\|.*\|/.test(resumeText)) problems.push("pipe characters suggest a table");
  const headings = ["experience", "education", "skills"].filter((h) => new RegExp(`^\\s*${h}\\b`, "im").test(resumeText));
  if (headings.length < 2) problems.push("standard headings (Experience, Education, Skills) are missing");
  if (/[‣▪●❖➢]/.test(resumeText)) problems.push("decorative bullet glyphs may not parse");
  const status: RiskStatus = problems.length === 0 ? "pass" : problems.length === 1 ? "warn" : "fail";
  return {
    id: "format",
    label: "Formatting and parsing",
    status,
    detail: problems.length === 0 ? "Single-column text with standard headings and contact details." : `Parser risks: ${problems.join("; ")}.`,
    fix: problems.length === 0 ? null : "Use one column, plain bullets, standard section headings, and your email on the first lines.",
  };
}

function leadershipCheck({ resumeText, jdText }: RiskInput): RiskCheck {
  const asked = LEADERSHIP_JD.test(jdText);
  const shown = tokenize(resumeText).some((t) => LEADERSHIP_VERBS.has(t.lower));
  if (!asked) {
    return { id: "leadership", label: "Leadership signals", status: "pass", detail: "The posting does not stress leadership.", fix: null };
  }
  return {
    id: "leadership",
    label: "Leadership signals",
    status: shown ? "pass" : "warn",
    detail: shown ? "The posting asks for leadership and your resume shows it." : "The posting asks for leadership but no bullet shows you leading, managing or mentoring.",
    fix: shown ? null : "If you have led people, projects or launches, say so with who and how many.",
  };
}

function lengthCheck({ resumeText, pages }: RiskInput): RiskCheck {
  const words = wordCount(resumeText);
  const limit = pages * WORDS_PER_PAGE;
  const status: RiskStatus = words <= limit ? "pass" : words <= limit * 1.2 ? "warn" : "fail";
  return {
    id: "length",
    label: "Fits the page",
    status,
    detail: `${words} words against roughly ${limit} for ${pages} page${pages > 1 ? "s" : ""}.`,
    fix: status === "pass" ? null : "Cut the oldest or least relevant bullets first.",
  };
}

function traceCheck({ untraceableLines }: RiskInput): RiskCheck {
  const n = untraceableLines ?? 0;
  return {
    id: "trace",
    label: "Every line traces to you",
    status: n === 0 ? "pass" : "warn",
    detail:
      n === 0
        ? "No rewritten line adds a number, employer or tool that is missing from your original resume."
        : `${n} rewritten line${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} your review.`,
    fix: n === 0 ? null : "Review each flagged line and confirm or remove it.",
  };
}
