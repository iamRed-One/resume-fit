export interface Token {
  raw: string;
  lower: string;
  stem: string;
}

export const STOPWORDS = new Set(
  (
    "a an the and or but if then else for of to in on at by with without from into onto over under as is are was were be been being " +
    "this that these those it its we our you your they their he she his her i me my us them who whom whose which what when where why how " +
    "will would can could should may might must shall do does did done have has had having not no nor so than too very just also " +
    "about above across after again against all any both each few more most other some such only own same up down out off per via " +
    "etc eg ie i.e e.g within including include includes plus able"
  ).split(" "),
);

// Words that show up in nearly every posting and say nothing about fit.
export const GENERIC = new Set(
  (
    "experience experienced work working works team teams ability abilities strong role roles company job jobs year years skill skills " +
    "candidate candidates position responsible responsibilities requirements requirement qualifications qualification preferred required " +
    "opportunity opportunities environment business knowledge understanding excellent great good new key related relevant ideal " +
    "looking join help helping support supporting ensure ensuring develop developing build building use using used based " +
    "demonstrated proven passion passionate impact day daily across within well like similar equivalent degree plus bonus nice " +
    "us we you our your will etc salary benefits equal employer apply application " +
    "end every owning own owned shipped ship familiarity familiar production services service technical various multiple mid level levels senior junior entry"
  ).split(" "),
);

// Irregular past forms that dominate resume writing; a suffix stripper cannot reach these.
const IRREGULAR: Record<string, string> = {
  led: "lead", built: "build", ran: "run", wrote: "write", drove: "drive", grew: "grow",
  taught: "teach", spoke: "speak", chose: "choose", sold: "sell", won: "win", began: "begin",
  made: "make", held: "hold", kept: "keep",
};

// Fields whose stem would collide with a different everyday word ("accounting" vs "accounts", "marketing" vs "market").
const NO_STEM = new Set(["accounting", "marketing", "trading"]);

/** Light stemmer: enough to match "manage/managed/managing/manages" without a dictionary. */
export function stem(word: string): string {
  if (NO_STEM.has(word)) return word;
  let w = IRREGULAR[word] ?? word;
  if (w.length > 5 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("es")) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** Splits on clause boundaries so n-grams never span a comma, bullet or sentence end. */
export function segments(text: string): string[] {
  return text
    .replace(/[‘’]/g, "'")
    .split(/[\n;:,()•·|!?]|\.\s|\s[-–—]\s/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  const matches = text.replace(/[‘’]/g, "'").match(/[A-Za-z0-9.][A-Za-z0-9+#./'-]*/g) ?? [];
  for (const raw of matches) {
    let cleaned = raw.replace(/['./-]+$/g, "");
    if (/^\.net$/i.test(cleaned)) cleaned = "dotnet";
    // "Swift/iOS", "JS/TS" and "value-selling" are several words; "CI/CD" and "A/B" are one term.
    const parts = KEEP_SLASH.test(cleaned) ? [cleaned] : cleaned.split(/[/-]+/);
    for (const part of parts) {
      const word = part.replace(/^\.+/, "").replace(/'s$/i, "").replace(/['.]+$/, "");
      if (!word) continue;
      const lower = word.toLowerCase();
      out.push({ raw: word, lower, stem: stem(lower) });
    }
  }
  return out;
}

const KEEP_SLASH = /^(ci\/cd|c\/c\+\+|pl\/sql|a\/b|tcp\/ip|i\/o)$/i;

export function stems(text: string): string[] {
  return tokenize(text).map((t) => t.stem);
}

/** True when `phrase` appears as a contiguous run in `haystack`. Both are stem arrays. */
export function hasPhrase(haystack: string[], phrase: string[]): boolean {
  if (phrase.length === 0 || phrase.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - phrase.length; i++) {
    for (let j = 0; j < phrase.length; j++) {
      if (haystack[i + j] !== phrase[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Counts non-overlapping runs of an alias in a token list. A `raw` alias must match case exactly. */
export function countAlt(tokens: Token[], alt: { stems: string[]; raw?: string[] }): number {
  const n = alt.stems.length;
  let count = 0;
  for (let i = 0; i + n <= tokens.length; ) {
    let ok = true;
    for (let j = 0; j < n && ok; j++) {
      ok = tokens[i + j].stem === alt.stems[j] && (!alt.raw || tokens[i + j].raw === alt.raw[j]);
    }
    if (ok) {
      count++;
      i += n;
    } else {
      i++;
    }
  }
  return count;
}

export function wordCount(text: string): number {
  return (text.match(/\S+/g) ?? []).length;
}

export const BULLET_RE = /^\s*([-*•·–]|\d+[.)])\s+/;

export function isBullet(line: string): boolean {
  return BULLET_RE.test(line);
}
