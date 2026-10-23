// Audits the items from the UI/UX checklist that the layout test does not cover: heading order, accessible
// names, keyboard order and tabs, reduced motion, landscape phones and 200% zoom.
//   npm run build && npx next start -p 3000      (in another terminal)
//   node e2e/a11y.mjs http://localhost:3000
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable.");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });

async function open(opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Try an example" }).first().click();
  await page.waitForSelector('[role="img"][aria-label^="Match score"]');
  await page.waitForTimeout(300);
  return { context, page };
}

// ---------------------------------------------------------------- structure
{
  const { context, page } = await open();
  const headings = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4")].filter((h) => h.getBoundingClientRect().height > 0).map((h) => ({ level: Number(h.tagName[1]), text: h.textContent.trim().slice(0, 40) })));
  const h1s = headings.filter((h) => h.level === 1);
  check("Exactly one h1 on the page", h1s.length === 1, `found ${h1s.length}: ${h1s.map((h) => h.text).join(", ") || "none"}`);
  let skipped = null;
  headings.reduce((prev, h) => {
    if (prev && h.level > prev + 1 && !skipped) skipped = `h${prev} then h${h.level} ("${h.text}")`;
    return h.level;
  }, 0);
  check("Headings never skip a level", !skipped, skipped ?? "");

  const landmarks = await page.evaluate(() => ({ main: document.querySelectorAll("main").length, header: document.querySelectorAll("header").length, nav: document.querySelectorAll("nav").length, lang: document.documentElement.lang }));
  check("One main landmark, a header, and a language set", landmarks.main === 1 && landmarks.header >= 1 && landmarks.lang === "en", JSON.stringify(landmarks));

  const unnamed = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=tab]")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0 && !el.matches("input[type=file]")) continue;
      const labelled = el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent.trim();
      const name = el.getAttribute("aria-label") || labelled || el.closest("label")?.textContent.trim() || el.textContent.trim() || el.getAttribute("title") || "";
      if (!name) bad.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}`);
    }
    return bad;
  });
  check("Every control has an accessible name", unnamed.length === 0, unnamed.join(", "));

  const dupIds = await page.evaluate(() => {
    const seen = new Map();
    for (const el of document.querySelectorAll("[id]")) seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
    return [...seen].filter(([, n]) => n > 1).map(([id]) => id);
  });
  check("No duplicate ids", dupIds.length === 0, dupIds.join(", "));
  await context.close();
}

// ----------------------------------------------------------------- keyboard
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(APP, { waitUntil: "networkidle" });
  const seen = [];
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    seen.push(
      await page.evaluate(() => {
        const el = document.activeElement;
        const cs = getComputedStyle(el);
        const visibleRing = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2;
        const r = el.getBoundingClientRect();
        return { tag: el.tagName.toLowerCase(), name: (el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 24), visibleRing, top: r.top, left: r.left };
      }),
    );
  }
  check("Skip link is the first Tab stop", /skip/i.test(seen[0].name), seen[0].name);
  check("Every Tab stop shows a visible focus ring", seen.every((s) => s.visibleRing), seen.filter((s) => !s.visibleRing).map((s) => s.name).join(", "));
  const order = seen.slice(1).filter((s) => s.top > 0 || s.left > 0);
  check("Tab order follows the visual order (top to bottom, left to right, per row)", order.every((s, i) => i === 0 || s.top >= order[i - 1].top - 80), seen.map((s) => s.name).join(" > ").slice(0, 200));

  // Tabs: arrow keys move between them, and only the selected one is in the Tab order.
  await page.getByRole("button", { name: "Try an example" }).first().click();
  await page.waitForSelector('[role="tab"]');
  await page.getByRole("tab", { name: /^Gaps/ }).focus();
  await page.keyboard.press("ArrowRight");
  check("Arrow keys move between result tabs", (await page.getByRole("tab", { name: /^Tailor/ }).getAttribute("aria-selected")) === "true");
  await page.keyboard.press("End");
  check("End jumps to the last tab", (await page.getByRole("tab", { name: /^Saved/ }).getAttribute("aria-selected")) === "true");
  const tabIdx = await page.evaluate(() => [...document.querySelectorAll('[role="tab"]')].map((t) => t.tabIndex));
  check("Only the selected tab is in the Tab order", tabIdx.filter((i) => i === 0).length === 1, tabIdx.join(","));
  await context.close();
}

// -------------------------------------------------------------- reduced motion
{
  const { context, page } = await open({ reducedMotion: "reduce" });
  const motion = await page.evaluate(() => ({
    ring: getComputedStyle(document.querySelector(".ring-value")).transitionDuration,
    press: (() => {
      const b = document.querySelector(".btn");
      b.style.setProperty("transition", "none");
      return true;
    })(),
  }));
  check("Reduced motion: the score ring no longer animates", /^0s(, 0s)*$/.test(motion.ring), motion.ring);
  await context.close();
}
{
  const { context, page } = await open();
  const normal = await page.evaluate(() => getComputedStyle(document.querySelector(".ring-value")).transitionDuration);
  check("Normal motion: the ring settles over a few hundred ms", /0\.4/.test(normal), normal);
  await context.close();
}

// -------------------------------------------------- landscape phone, 200% zoom
for (const v of [
  { name: "landscape phone 844x390", viewport: { width: 844, height: 390 }, opts: { hasTouch: true, isMobile: true } },
  { name: "200% zoom on a laptop (640x360 css px)", viewport: { width: 640, height: 360 }, opts: {} },
]) {
  const { context, page } = await open({ viewport: v.viewport, ...v.opts });
  const m = await page.evaluate(() => ({ overflowX: document.documentElement.scrollWidth > window.innerWidth + 1, h: document.documentElement.scrollHeight, vh: window.innerHeight }));
  check(`${v.name}: no horizontal scroll`, !m.overflowX);
  const bad = [];
  for (const frac of [0, 0.5, 1]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(Math.max(0, m.h - m.vh) * frac));
    await page.waitForTimeout(100);
    const b = await page.evaluate(() => {
      const r = document.querySelector('[role="img"][aria-label^="Match score"]').getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: window.innerHeight };
    });
    if (b.top < 0 || b.bottom > b.vh) bad.push(`y=${b.top}..${b.bottom}`);
  }
  check(`${v.name}: score visible at every scroll position`, bad.length === 0, bad.join("; "));
  const room = await page.evaluate(() => {
    const bar = document.querySelector(".bottombar");
    const score = document.querySelector(".score").getBoundingClientRect();
    const barH = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
    return { chrome: Math.round(score.height + barH), vh: window.innerHeight };
  });
  check(`${v.name}: pinned bars leave at least half the screen for content`, room.chrome <= room.vh / 2, `${room.chrome}px of ${room.vh}px used by the score bar and bottom bar`);
  await context.close();
}

// ------------------------------------------------------------- how it works
for (const v of [
  { name: "desktop", viewport: { width: 1440, height: 900 }, opts: {} },
  { name: "phone", viewport: { width: 390, height: 844 }, opts: { hasTouch: true, isMobile: true } },
]) {
  const context = await browser.newContext({ viewport: v.viewport, ...v.opts });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(new URL("/how-it-works", APP).toString(), { waitUntil: "networkidle" });

  const heads = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].map((h) => Number(h.tagName[1])));
  const skipped = heads.some((h, i) => i > 0 && h > heads[i - 1] + 1);
  check(`How it works (${v.name}): one h1 and no skipped heading level`, heads.filter((h) => h === 1).length === 1 && !skipped, heads.join(""));
  check(`How it works (${v.name}): no horizontal scroll`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)));

  // Each example's verdict comes from the real checking code at build time; these are the right answers.
  const verdicts = await page.locator(".example .badge").allInnerTexts();
  check(`How it works (${v.name}): the five worked examples get the right verdicts`, JSON.stringify(verdicts.map((t) => t.toLowerCase())) === JSON.stringify(["fine", "not supported", "not supported", "confirm", "fine"]), verdicts.join(", "));
  const why = await page.locator(".example").allInnerTexts();
  check(`How it works (${v.name}): the reasons name the actual problem`, /52%/.test(why[1]) && /Elasticsearch/.test(why[2]) && /Kubernetes/.test(why[3]));
  check(`How it works (${v.name}): the real sample score is shown`, /score is\s*\d+/.test(await page.locator(".callout").innerText()));

  // The five steps sit in one row on a desktop and stack on a phone.
  const flowTops = await page.evaluate(() => [...document.querySelectorAll(".flow li")].map((li) => Math.round(li.getBoundingClientRect().top)));
  const oneRow = flowTops.length === 5 && flowTops.every((t) => Math.abs(t - flowTops[0]) <= 2);
  check(`How it works (${v.name}): the five steps ${v.name === "desktop" ? "sit in one row" : "stack in one column"}`, v.name === "desktop" ? oneRow : !oneRow && flowTops.length === 5, flowTops.join(","));

  // Every button on the page must have text you can read (a link colour once bled into the primary button).
  const buttons = await page.evaluate(() => {
    const lum = (rgb) => {
      const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map((c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    return [...document.querySelectorAll(".btn")].filter((b) => b.getBoundingClientRect().height > 0).map((b) => {
      const cs = getComputedStyle(b);
      const [hi, lo] = [lum(cs.color), lum(cs.backgroundColor)].sort((x, y) => y - x);
      return { text: b.textContent.trim().slice(0, 28) || b.getAttribute("aria-label"), ratio: (hi + 0.05) / (lo + 0.05), transparent: /rgba\(.*, 0\)$/.test(cs.backgroundColor) };
    });
  });
  const unreadable = buttons.filter((b) => !b.transparent && b.ratio < 4.5);
  check(`How it works (${v.name}): every button's text is readable against its fill`, unreadable.length === 0, unreadable.map((b) => `"${b.text}" ${b.ratio.toFixed(1)}:1`).join(", "));

  const anchors = await page.evaluate(() => [...document.querySelectorAll('.toc a[href^="#"]')].map((a) => ({ href: a.getAttribute("href"), ok: !!document.querySelector(a.getAttribute("href")) })));
  check(`How it works (${v.name}): every "on this page" link has a target`, anchors.length >= 5 && anchors.every((a) => a.ok), anchors.filter((a) => !a.ok).map((a) => a.href).join(", "));

  if (v.opts.hasTouch) {
    const small = await page.evaluate(() => [...document.querySelectorAll("a[href], button")].filter((el) => el.getBoundingClientRect().height > 0 && el.getBoundingClientRect().height < 43.5).map((el) => (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)));
    check(`How it works (${v.name}): every link and button is at least 44px tall`, small.length === 0, small.join(", "));
  }

  // The way in and the way back.
  await page.goto(APP, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: "How it works" }).click();
  await page.waitForURL(/how-it-works/);
  check(`How it works (${v.name}): reachable from the app's top bar`, true);
  await page.getByRole("link", { name: /Open the app|Resume Fit, home/ }).first().click();
  await page.waitForURL((u) => u.pathname === "/");
  check(`How it works (${v.name}): the app is one click back`, true);
  check(`How it works (${v.name}): no browser errors`, errors.length === 0, errors.join(" | ").slice(0, 200));
  if (v.name === "desktop") {
    await page.goto(new URL("/how-it-works", APP).toString(), { waitUntil: "networkidle" });
    await page.screenshot({ path: new URL("./out/how-it-works-desktop.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), fullPage: true });
  } else {
    await page.goto(new URL("/how-it-works", APP).toString(), { waitUntil: "networkidle" });
    await page.screenshot({ path: new URL("./out/how-it-works-phone.png", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), fullPage: true });
  }
  await context.close();
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
