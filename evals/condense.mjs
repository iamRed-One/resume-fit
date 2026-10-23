import { readdirSync, readFileSync } from "node:fs";
const dir = process.argv[2], pick = process.argv[3], cap = +process.argv[4] || 2400;
for (const f of readdirSync(dir).filter((f) => f.startsWith(pick)).sort()) {
  const t = readFileSync(dir + "/" + f, "utf8");
  const title = t.match(/^Title: (.*)$/m)[1];
  const lines = t.split("\n").slice(6).map((l) => l.trim()).filter((l) => /^- /.test(l) || (l.length < 60 && /[A-Za-z]/.test(l) && !/[.!?]$/.test(l)));
  let out = "";
  for (const l of lines) { if (out.length + l.length > cap) break; out += l.slice(0, 150) + "\n"; }
  console.log(`\n##### ${f.replace(".txt", "")} | ${title}\n${out}`);
}
