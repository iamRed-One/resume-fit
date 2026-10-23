import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "vitest";
import { MODEL_ID, claudeModel, usage } from "@/lib/anthropic";
import { formatReport, loadPairs, runPair, type PairResult } from "./live-core";

// Runs resume x posting pairs through the REAL model and reports whether it stays honest.
// This spends API credit, so it does nothing unless you opt in:
//
//   bash / zsh:   LIVE=1 npm run eval:live
//   PowerShell:   $env:LIVE="1"; npm run eval:live
//
//   LIVE_LIMIT=4   how many pairs to run (default 4; there are 13 in evals/data/pairs.json)
//   LIVE_TAG=run1  names the report files in evals/out/
//
// The default four pairs include two poor-fit negative controls, because a tool that quietly invents
// experience to close a gap would look great on good-fit pairs and only fail there.

const LIVE = process.env.LIVE === "1";
const LIMIT = Number(process.env.LIVE_LIMIT ?? 4);
// Spread good / poor / partial pairs so a small LIMIT still contains negative controls.
const ORDER = [0, 2, 3, 6, 7, 9, 11, 12, 1, 4, 5, 8, 10];

describe.skipIf(!LIVE)("live tailoring", () => {
  it(
    "runs the pairs and reports",
    async () => {
      const all = loadPairs();
      const chosen = ORDER.filter((i) => i < all.length)
        .slice(0, LIMIT)
        .map((i) => all[i]);
      const results: PairResult[] = [];
      for (const pair of chosen) {
        results.push(await runPair(pair, claudeModel, { pages: 1, tone: "standard professional", intensity: "balanced" }));
      }
      const report = formatReport(results, { model: MODEL_ID, ...usage });
      const tag = process.env.LIVE_TAG ?? new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      const out = path.join(import.meta.dirname, "out");
      mkdirSync(out, { recursive: true });
      writeFileSync(path.join(out, `live-${tag}.txt`), report);
      writeFileSync(path.join(out, `live-${tag}.json`), JSON.stringify({ model: MODEL_ID, usage, results }, null, 2));
      console.log(report);
    },
    60 * 60 * 1000,
  );
});
