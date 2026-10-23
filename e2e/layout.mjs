// Measures the layout instead of guessing at it, and saves screenshots to e2e/out/ (gitignored).
//
//   npm run build && npx next start -p 3000      (in another terminal)
//   node e2e/layout.mjs http://localhost:3000 [label]
//
// What it enforces:
//  - the match score is on screen at EVERY scroll position, on four screen sizes
//  - on a desktop the page itself does not scroll (the panes scroll inside themselves)
//  - no horizontal scroll anywhere
//  - on a touch device every control is at least 44px tall
//  - the export bar stays reachable while a long result scrolls
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const LABEL = process.argv[3] ?? "run";
const OUT = path.join(import.meta.dirname, "out");
mkdirSync(OUT, { recursive: true });

const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable.");

const VIEWPORTS = [
  { name: "laptop 1440x900", width: 1440, height: 900, desktop: true },
  { name: "small laptop 1280x720", width: 1280, height: 720, desktop: true },
  { name: "tablet 820x1180", width: 820, height: 1180, touch: true },
  { name: "phone 390x844", width: 390, height: 844, touch: true },
];

const REPLY = `=== RESUME ===
Jordan Rivera
jordan.rivera@example.com

Skills
TypeScript, Node.js, PostgreSQL, Redis, Docker, GraphQL

Experience
Senior Software Engineer, Northwind Payments (2021 - Present)
- Led 4 engineers building the invoicing API for 1,200 merchants and moved the billing ledger to services
- Cut p95 checkout latency by 52% with a Redis cache in front of PostgreSQL
- Built search with Elasticsearch
- Ran production services on Kubernetes
- Mentored three junior engineers and ran weekly design reviews
- Wrote integration tests and ran code reviews for the payments squad

Software Engineer, Contoso Labs (2018 - 2021)
- Built internal admin tools in React and Node.js
- Migrated cron jobs to a queue-based worker system

Education
B.Sc. Computer Science, University of Waterloo, 2018

=== CHANGES ===
Before: Led a team of 4 / After: Led 4 / Why: concise

=== SKILLS I COULD NOT ADD ===
- AWS
- Terraform
`;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
};

const scoreBox = (page) =>
  page.evaluate(() => {
    const r = document.querySelector('[role="img"][aria-label^="Match score"]').getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
  });
const pageMetrics = (page) =>
  page.evaluate(() => ({
    pageHeight: document.documentElement.scrollHeight,
    vh: window.innerHeight,
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));

async function scoreAlwaysVisible(page, vp, label) {
  const m = await pageMetrics(page);
  const maxScroll = Math.max(0, m.pageHeight - m.vh);
  const bad = [];
  for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(maxScroll * frac));
    await page.waitForTimeout(100);
    const b = await scoreBox(page);
    if (b.top < 0 || b.bottom > b.vh) bad.push(`scrollY=${Math.round(maxScroll * frac)}: y=${b.top}..${b.bottom}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  check(`${vp.name}${label}: score visible at every scroll position (page ${m.pageHeight}px, screen ${m.vh}px)`, bad.length === 0, bad.join("; "));
}

// The resume and posting sit side by side wherever there is room (700px and up) and stack on a phone;
// the options sit above them; on a desktop every option is visible without a click.
async function arrangement(page, vp) {
  const a = await page.evaluate(() => {
    const [resume, posting] = [...document.querySelectorAll(".docs-pair .doc")].map((el) => el.getBoundingClientRect());
    const pair = document.querySelector(".docs-pair").getBoundingClientRect();
    const options = document.querySelector(".options").getBoundingClientRect();
    const title = document.querySelector("#title").getBoundingClientRect();
    const toggle = getComputedStyle(document.querySelector(".options-toggle")).display;
    return { resume, posting, pair, options, titleVisible: title.height > 0, toggle };
  });
  const sideBySide = Math.abs(a.resume.top - a.posting.top) <= 2 && a.resume.right <= a.posting.left + 1;
  if (vp.width >= 700) check(`${vp.name}: resume and posting are side by side`, sideBySide, `resume x=${Math.round(a.resume.left)}..${Math.round(a.resume.right)}, posting x=${Math.round(a.posting.left)}..${Math.round(a.posting.right)}`);
  else check(`${vp.name}: resume and posting stack on a phone`, !sideBySide && a.posting.top >= a.resume.bottom - 1);
  check(`${vp.name}: options are above the editors`, a.options.bottom <= a.pair.top + 1, `options end y=${Math.round(a.options.bottom)}, editors start y=${Math.round(a.pair.top)}`);
  if (vp.desktop) check(`${vp.name}: all option fields are visible without a click`, a.titleVisible && a.toggle === "none");
  else check(`${vp.name}: options fold into one tappable row`, a.toggle !== "none" && !a.titleVisible);
}

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
for (const vp of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: !!vp.touch, isMobile: !!vp.touch, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(APP, { waitUntil: "networkidle" });

  // Empty state first: it must not look broken.
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${vp.width}-0-empty.png`) });

  await page.getByRole("button", { name: "Try an example" }).first().click();
  await page.waitForSelector('[role="img"][aria-label^="Match score"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  const m = await pageMetrics(page);
  const b = await scoreBox(page);
  check(`${vp.name}: score is on screen straight away`, b.top >= 0 && b.bottom <= b.vh, `y=${b.top}..${b.bottom} of ${b.vh}px`);
  check(`${vp.name}: no horizontal scroll`, !m.overflowX);
  if (vp.desktop) check(`${vp.name}: the page itself does not scroll`, m.pageHeight <= m.vh + 1, `page ${m.pageHeight}px, screen ${m.vh}px`);

  // Nothing may spill out of its box or sit on top of its neighbour (this once hid the Job posting header).
  const overlap = await page.evaluate(() => {
    const problems = [];
    const docs = document.querySelector(".docs");
    if (docs && getComputedStyle(docs).display !== "none") {
      if (docs.scrollHeight > docs.clientHeight + 1) problems.push(`documents column overflows by ${docs.scrollHeight - docs.clientHeight}px`);
      const boxes = [...docs.children].filter((el) => el.getBoundingClientRect().height > 0).map((el) => ({ name: el.className || el.tagName, r: el.getBoundingClientRect() }));
      for (let i = 1; i < boxes.length; i++) {
        if (boxes[i].r.top < boxes[i - 1].r.bottom - 1) problems.push(`"${boxes[i].name}" overlaps "${boxes[i - 1].name}" by ${Math.round(boxes[i - 1].r.bottom - boxes[i].r.top)}px`);
      }
      for (const ta of docs.querySelectorAll("textarea")) {
        const box = ta.closest(".doc-box").getBoundingClientRect();
        const t = ta.getBoundingClientRect();
        if (t.bottom > box.bottom + 1) problems.push(`a text box spills ${Math.round(t.bottom - box.bottom)}px out of its frame`);
      }
    }
    return problems;
  });
  check(`${vp.name}: editors fit their frames and do not overlap`, overlap.length === 0, overlap.join("; "));
  if (vp.desktop) await arrangement(page, vp);
  await scoreAlwaysVisible(page, vp, "");
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${vp.width}-1-gaps.png`) });

  // Every tab, still with the score visible and nothing overflowing.
  for (const tab of ["Tailor", "Review", "Saved"]) {
    if (vp.touch) await page.getByRole("button", { name: "Results" }).click();
    await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
    await page.waitForTimeout(120);
    const mt = await pageMetrics(page);
    if (vp.desktop) check(`${vp.name}: ${tab} tab fits without scrolling the page`, mt.pageHeight <= mt.vh + 1, `page ${mt.pageHeight}px, screen ${mt.vh}px`);
    check(`${vp.name}: ${tab} tab has no horizontal scroll`, !mt.overflowX);
  }

  // The real flow: paste an AI reply, land on the check.
  if (vp.touch) await page.getByRole("button", { name: "Results" }).click();
  await page.getByRole("tab", { name: /^Tailor/ }).click();
  await page.locator("#reply").fill(REPLY);
  await page.waitForSelector("text=add something your resume does not support", { timeout: 10000 });
  await page.waitForTimeout(500);
  check(`${vp.name}: pasting a reply opens the Review tab`, (await page.getByRole("tab", { name: /^Review/ }).getAttribute("aria-selected")) === "true");
  await scoreAlwaysVisible(page, vp, " (review)");

  // The export bar must be reachable without hunting for it.
  const bar = await page.evaluate(() => {
    const r = document.querySelector(".exportbar")?.getBoundingClientRect();
    return r ? { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight } : null;
  });
  check(`${vp.name}: export bar is reachable on screen`, !!bar && bar.top >= 0 && bar.bottom <= bar.vh + 1, bar ? `y=${bar.top}..${bar.bottom} of ${bar.vh}px` : "missing");
  if (bar) check(`${vp.name}: export bar is one compact row (${bar.bottom - bar.top}px)`, bar.bottom - bar.top <= 76, `${bar.bottom - bar.top}px tall`);
  if (vp.desktop) {
    const gap = await page.evaluate(() => {
      const b = document.querySelector(".exportbar").getBoundingClientRect();
      const p = document.querySelector(".results").getBoundingClientRect();
      return Math.round(p.bottom - b.bottom);
    });
    check(`${vp.name}: export bar sits flush with the bottom of the pane (no content peeking underneath)`, gap <= 2, `${gap}px gap`);
  }
  await page.screenshot({ path: path.join(OUT, `${LABEL}-${vp.width}-2-review.png`) });

  if (vp.touch) {
    const small = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("button, a[href], input:not([hidden]):not([type=hidden]), select, summary, [role=tab]")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 43.5) bad.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.height)}px`);
      }
      return bad;
    });
    check(`${vp.name}: every visible control is at least 44px tall`, small.length === 0, small.slice(0, 6).join("; "));
    // Documents view too.
    await page.getByRole("button", { name: "Documents" }).click();
    await page.waitForTimeout(150);
    const small2 = await page.evaluate(() => {
      const bad = [];
      for (const el of document.querySelectorAll("button, a[href], input:not([hidden]):not([type=hidden]), select, summary")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.height < 43.5) bad.push(`${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.height)}px`);
      }
      return bad;
    });
    check(`${vp.name}: controls on the Documents view are at least 44px tall`, small2.length === 0, small2.slice(0, 6).join("; "));
    await arrangement(page, vp);
    await scoreAlwaysVisible(page, vp, " (documents)");
    await page.screenshot({ path: path.join(OUT, `${LABEL}-${vp.width}-3-documents.png`) });
  }

  // A look at every theme on the screens people use most.
  if (vp.width === 1440 || vp.width === 390) {
    if (vp.touch) await page.getByRole("button", { name: "Results" }).click();
    for (const theme of ["ocean", "emerald", "graphite", "midnight"]) {
      await page.getByRole("button", { name: new RegExp(`^${theme[0].toUpperCase()}${theme.slice(1)}`) }).click();
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(OUT, `${LABEL}-${vp.width}-theme-${theme}.png`) });
    }
    const saved = await page.evaluate(() => document.documentElement.dataset.theme);
    check(`${vp.name}: picking a theme applies it`, saved === "midnight");
    await page.reload({ waitUntil: "networkidle" });
    check(`${vp.name}: the chosen theme is remembered after a reload`, (await page.evaluate(() => document.documentElement.dataset.theme)) === "midnight");
  }

  check(`${vp.name}: no browser errors`, errors.length === 0, errors.join(" | ").slice(0, 240));
  await context.close();
}
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
