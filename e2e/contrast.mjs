// Computes the WCAG contrast ratio of the colour pairs the interface actually uses, in every theme.
//   node e2e/contrast.mjs http://localhost:3000
// Text needs 4.5:1. Outlines that identify a control (inputs) need 3:1.
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable.");

const THEMES = ["ocean", "emerald", "graphite", "midnight"];
// [foreground, background, minimum ratio, what it is]
const PAIRS = [
  ["--ink", "--bg", 4.5, "body text on the page"],
  ["--ink", "--surface", 4.5, "body text on cards"],
  ["--muted", "--bg", 4.5, "secondary text on the page"],
  ["--muted", "--surface", 4.5, "secondary text on cards"],
  ["--on-primary", "--primary", 4.5, "label on a primary button"],
  ["--primary", "--surface", 4.5, "active tab / bottom bar label"],
  ["--accent", "--surface", 4.5, "links and focus ring"],
  ["--accent", "--bg", 4.5, "links on the page"],
  ["--good", "--good-bg", 4.5, "matched chip / success banner"],
  ["--warn", "--warn-bg", 4.5, "missing chip / warning banner"],
  ["--bad", "--bad-bg", 4.5, "error banner / unsupported badge"],
  ["--good", "--surface", 4.5, "success text on cards"],
  ["--warn", "--surface", 4.5, "warning text on cards"],
  ["--bad", "--surface", 4.5, "error text on cards"],
  ["--on-ink", "--ink", 4.5, "toast"],
  ["--field", "--surface", 3, "input outline on a card"],
  ["--field", "--bg", 3, "input outline on the page"],
  ["--good", "--ring-track", 3, "score ring (strong) against its track"],
  ["--warn", "--ring-track", 3, "score ring (partial) against its track"],
  ["--bad", "--ring-track", 3, "score ring (weak) against its track"],
];

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  // The production CSS minifier writes #ffffff as #fff, so expand 3-digit colours before parsing.
  const full = /^#[0-9a-f]{3}$/i.test(hex) ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
  const n = parseInt(full.slice(1), 16);
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
await page.goto(APP, { waitUntil: "networkidle" });
let failed = 0;
for (const theme of THEMES) {
  const vars = await page.evaluate((t) => {
    document.documentElement.dataset.theme = t;
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries([...new Set(["--ink", "--bg", "--surface", "--muted", "--on-primary", "--primary", "--accent", "--good", "--good-bg", "--warn", "--warn-bg", "--bad", "--bad-bg", "--on-ink", "--field", "--ring-track"])].map((k) => [k, cs.getPropertyValue(k).trim()]));
  }, theme);
  const bad = [];
  let worst = Infinity;
  for (const [fg, bg, min, what] of PAIRS) {
    const r = ratio(vars[fg], vars[bg]);
    worst = Math.min(worst, r / min);
    if (r < min) bad.push(`${what}: ${fg} ${vars[fg]} on ${bg} ${vars[bg]} = ${r.toFixed(2)}:1 (needs ${min})`);
  }
  failed += bad.length;
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${theme.padEnd(9)} ${PAIRS.length - bad.length}/${PAIRS.length} pairs readable${bad.length ? "\n        " + bad.join("\n        ") : ""}`);
}
await browser.close();
console.log(failed ? `\n${failed} pair(s) too low` : "\nAll pairs meet WCAG in every theme");
process.exit(failed ? 1 : 0);
