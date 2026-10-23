// Prints a table from evals/out/extraction-<tag>.json.
//   node evals/summarize.mjs <tag>                 aggregates only
//   node evals/summarize.mjs <tag> --tune-detail   per-posting misses/junk for the TUNE set
//   node evals/summarize.mjs <tag> --dev-detail    per-posting misses/junk for the DEV set
//   (there is deliberately no detail view for the SEALED set)
import { readFileSync } from "node:fs";

const tag = process.argv[2] ?? "latest";
const rows = JSON.parse(readFileSync(new URL(`./out/extraction-${tag}.json`, import.meta.url), "utf8"));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (x) => `${(x * 100).toFixed(0)}%`.padStart(4);
const line = (name, rs) => `${name.padEnd(22)} n=${String(rs.length).padStart(2)}  recall ${pct(mean(rs.map((r) => r.recall)))}  precision@15 ${pct(mean(rs.map((r) => r.precision)))}`;

const NOTE = { tune: "", dev: "  (labelled blind, now used to find mistakes)", sealed: "  (never printed per-posting, but labelled by the same person who later expanded the dictionary: treat as optimistic)" };
for (const split of ["tune", "dev", "sealed"]) {
  const rs = rows.filter((r) => r.split === split);
  if (!rs.length) continue;
  console.log(`\n${split.toUpperCase()}${NOTE[split]}`);
  console.log(line("  all", rs));
  console.log(line("  software", rs.filter((r) => r.group === "swe")));
  console.log(line("  other", rs.filter((r) => r.group === "other")));
}

for (const split of ["tune", "dev"]) {
  if (!process.argv.includes(`--${split}-detail`)) continue;
  console.log(`\n${split.toUpperCase()} detail:`);
  for (const r of rows.filter((r) => r.split === split)) {
    console.log(`  ${r.file.padEnd(22)} recall ${pct(r.recall)} prec ${pct(r.precision)}  missed: ${r.missed.join(", ") || "-"}`);
    console.log(`  ${"".padEnd(22)} junk: ${r.junk.join(", ") || "-"}`);
  }
}
