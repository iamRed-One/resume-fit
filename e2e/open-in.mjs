// Drives the "Open Claude / ChatGPT / Gemini" links on the Tailor tab in a real browser: every click must put
// the full prompt on the clipboard and say so, and a prompt too long for a link must open the assistant empty
// rather than cut off. No request ever reaches the assistants' sites: those navigations are blocked.
//
//   npm run build && npx next start -p 3000      (in another terminal)
//   npm run e2e:open-in                          (or: node e2e/open-in.mjs http://localhost:3000)
//
// Set CHROME_PATH if Chrome or Chromium is not in a standard location. Nothing is downloaded.
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const CHROME = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].find((p) => p && existsSync(p));
if (!CHROME) {
  console.error("Chrome not found. Set CHROME_PATH to a Chrome or Chromium executable.");
  process.exit(2);
}

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const origin = new URL(APP).origin;
await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
const blocked = [];
await context.route((url) => url.origin !== origin, (route) => {
  blocked.push(route.request().url());
  return route.abort();
});
const page = await context.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !/Failed to load resource|ERR_FAILED/.test(m.text()) && problems.push("console: " + m.text()));

await page.goto(APP, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Try an example" }).first().click();
await page.getByRole("tab", { name: /^Tailor/ }).click();
await page.waitForSelector(".open-in a");

const prompt = await page.locator('textarea[aria-label="Prompt text"]').evaluate((el) => el.value);
const encodedLength = encodeURIComponent(prompt).length;
check("the example prompt is too long for a link, so the fallback is what gets tested", encodedLength > 6000, `${encodedLength} characters once encoded`);

const hrefs = await page.locator(".open-in a").evaluateAll((as) => as.map((a) => [a.textContent.trim(), a.href]));
check("Claude opens its new-chat page, with no cut-off prompt in the link", hrefs[0][1] === "https://claude.ai/new", hrefs[0][1]);
check("ChatGPT opens its home page, with no cut-off prompt in the link", hrefs[1][1] === "https://chatgpt.com/", hrefs[1][1]);
check("Gemini opens its app", hrefs[2][1] === "https://gemini.google.com/app", hrefs[2][1]);
check("the links open in a new tab without leaking the opener", await page.locator('.open-in a[target="_blank"][rel~="noopener"]').count() === 3);

const status = page.locator(".step p[role=status]");
check("nothing is announced before a click", (await status.innerText()).trim() === "");

await page.locator(".open-in a", { hasText: "Claude" }).click();
await page.waitForFunction(() => /Prompt copied/.test(document.querySelector(".step p[role=status]")?.textContent ?? ""));
check("clicking Claude says the prompt was copied and where to paste it", /Prompt copied\. In Claude, click the message box and paste it/.test(await status.innerText()));
// Windows hands line breaks back as \r\n; the text is otherwise identical.
const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, "\n");
check("the clipboard holds the whole prompt", clip === prompt, clip === prompt ? "" : `clipboard ${clip.length} characters, prompt ${prompt.length}`);

await page.locator(".open-in a", { hasText: "Gemini" }).click();
await page.waitForFunction(() => /In Gemini/.test(document.querySelector(".step p[role=status]")?.textContent ?? ""));
check("the message follows the assistant that was clicked", /In Gemini/.test(await status.innerText()));

await page.waitForTimeout(300);
check("only the assistants' pages were blocked, nothing else left the app", blocked.every((u) => /claude\.ai|chatgpt\.com|gemini\.google\.com/.test(u)), blocked.join(", "));
check("no browser errors", problems.length === 0, problems.join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
