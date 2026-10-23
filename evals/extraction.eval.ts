import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { extractRequirements } from "@/lib/keywords";
import { stems } from "@/lib/text";

// Scores keyword extraction against hand labels.
//   npm run eval:extract            -> evals/out/extraction-<tag>.json, then: node evals/summarize.mjs <tag>
//   EVAL_TAG=v5 npm run eval:extract
//
// Three splits, kept apart on purpose:
//   tune   = data/postings                          the extractor was developed against these
//   dev    = even-numbered files of data/blind      labelled before the extractor saw them; now used to find mistakes
//   sealed = odd-numbered files of data/blind       never inspected per-posting; score it rarely, ideally once
// Once you tune against a miss in a split, it is no longer an honest test. When sealed is spent,
// fetch and label a fresh set (node evals/fetch-postings.mjs --blind) before trusting any number again.

const DATA = path.join(import.meta.dirname, "data");
const TOP_N = 30;
const PRECISION_AT = 15;

type Label = string[][];
type Labels = Record<string, { must: Label; ok: Label }>;

function readLabels(): { tune: Labels; blind: Labels } {
  const tune = JSON.parse(readFileSync(path.join(DATA, "labels.json"), "utf8")) as Labels;
  delete (tune as Record<string, unknown>)._note;
  const blind: Labels = {};
  for (const f of readdirSync(path.join(DATA, "labels-blind"))) {
    Object.assign(blind, JSON.parse(readFileSync(path.join(DATA, "labels-blind", f), "utf8")));
  }
  return { tune, blind };
}

function containsRun(hay: string[], needle: string[]): boolean {
  for (let i = 0; i + needle.length <= hay.length; i++) if (needle.every((s, j) => hay[i + j] === s)) return true;
  return false;
}
const overlaps = (a: string[], b: string[]) => a.length > 0 && b.length > 0 && (containsRun(a, b) || containsRun(b, a));
const forms = (l: string[][]) => l.map((alts) => alts.map((a) => stems(a)));

interface Row {
  file: string;
  group: "swe" | "other";
  split: "tune" | "dev" | "sealed";
  recall: number;
  precision: number;
  extracted: number;
  missed: string[];
  junk: string[];
}

function evaluate(splitFor: (index: number) => Row["split"], dir: string, labels: Labels): Row[] {
  const files = readdirSync(path.join(DATA, dir)).filter((f) => f.endsWith(".txt")).sort();
  return files.map((f, index) => {
    const split = splitFor(index);
    const key = f.replace(/\.txt$/, "");
    const raw = readFileSync(path.join(DATA, dir, f), "utf8");
    const group = /^Group: (\w+)/m.exec(raw)![1] as "swe" | "other";
    const body = raw.split("\n").slice(6).join("\n");
    const lab = labels[key];
    if (!lab) throw new Error(`no labels for ${split}/${key}`);

    const reqs = extractRequirements(body).slice(0, TOP_N);
    const must = forms(lab.must);
    const ok = forms(lab.ok);

    // A requirement counts as found if ANY of its spellings overlaps a label (so "Postgres" == "PostgreSQL").
    const hit = (r: (typeof reqs)[number], label: string[][]) => r.alts.some((alt) => label.some((a) => overlaps(alt.stems, a)));
    const covered = must.map((alts) => reqs.some((r) => hit(r, alts)));
    const top = reqs.slice(0, PRECISION_AT);
    const relevant = top.filter((r) => [...must, ...ok].some((alts) => hit(r, alts)));

    return {
      file: key,
      group,
      split,
      recall: covered.filter(Boolean).length / must.length,
      precision: top.length ? relevant.length / top.length : 0,
      extracted: reqs.length,
      missed: lab.must.filter((_, j) => !covered[j]).map((a) => a[0]),
      junk: top.filter((r) => !relevant.includes(r)).map((r) => r.term),
    };
  });
}

describe("keyword extraction vs hand labels", () => {
  it("reports recall and precision on both datasets", () => {
    const labels = readLabels();
    const rows = [...evaluate(() => "tune", "postings", labels.tune), ...evaluate((i) => (i % 2 === 0 ? "dev" : "sealed"), "blind", labels.blind)];
    const tag = process.env.EVAL_TAG ?? "latest";
    mkdirSync(path.join(import.meta.dirname, "out"), { recursive: true });
    writeFileSync(path.join(import.meta.dirname, "out", `extraction-${tag}.json`), JSON.stringify(rows, null, 2));
  });
});
