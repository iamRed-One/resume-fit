// Exercises the "automatic" screens against a FAKE server, so the UI wiring is tested without an API key or
// any model call: error handling, the change log, tap-to-add skills, the cover letter, saving, reload.
//   npm run build && npx next start -p 3000      (in another terminal)
//   node e2e/auto-mock.mjs http://localhost:3000
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const CHROME = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/usr/bin/google-chrome", "/usr/bin/chromium"].find((p) => p && existsSync(p));
if (!CHROME) throw new Error("Set CHROME_PATH to a Chrome or Chromium executable.");

const TAILORED = {
  resume: {
    name: "Jordan Rivera",
    contact: ["jordan.rivera@example.com"],
    summary: "Backend engineer with six years building payment APIs.",
    skills: ["TypeScript", "Node.js", "PostgreSQL", "Redis", "Docker", "GraphQL"],
    experience: [
      {
        title: "Senior Software Engineer",
        company: "Northwind Payments",
        dates: "2021 - Present",
        bullets: ["Led a team of 4 engineers building the invoicing API used by 1,200 merchants", "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL"],
      },
    ],
    education: ["B.Sc. Computer Science, University of Waterloo, 2018"],
    additional: [],
  },
  changeLog: [
    { section: "experience", before: "Reduced p95 checkout latency by 38% by adding a Redis cache in front of PostgreSQL", after: "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL", requirement: "query performance", reason: "Leads with the result.", status: "applied" },
    { section: "experience", before: "Mentored three junior engineers", after: "Mentored 5 junior engineers", requirement: "mentoring", reason: "Stronger.", status: "reverted", note: "Reverted to your original wording: number not in your resume: 5." },
  ],
  suggestedSkills: ["Kubernetes", "AWS"],
  warnings: [],
  flagged: 1,
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !/status of 500/.test(m.text()) && errors.push(m.text()));

let mode = "error";
await page.route("**/api/tailor", (route) =>
  mode === "error"
    ? route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "The server's Anthropic credentials are missing or invalid." }) })
    : route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(TAILORED) }),
);
await page.route("**/api/cover-letter", (route) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ text: "Dear Hiring Manager, I led 4 engineers and cut latency 38%.", grounding: { numbers: [], invented: [], unconfirmed: [], ok: true } }) }),
);

await page.goto(APP, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Try an example" }).first().click();
await page.waitForSelector('[role="img"][aria-label^="Match score"]');
const ringScore = async (prefix) => Number(((await page.locator(`[role="img"][aria-label^="${prefix}"]`).first().getAttribute("aria-label")) ?? "").match(/: (\d+)/)[1]);
const scoreBefore = await ringScore("Match score:");

// 1. The server fails (no key): the user is told, nothing breaks.
await page.getByRole("tab", { name: /^Tailor/ }).click();
await page.getByText("Or let our server do it").click();
await page.getByRole("button", { name: "Tailor automatically" }).click();
await page.waitForSelector("text=credentials are missing or invalid");
check("A server error is shown plainly, next to the button", true);
check("A server error leaves the score as it was", (await page.locator('[role="img"][aria-label^="Match score"]').count()) === 1);

// 2. The server answers: the change log and what needs review.
mode = "ok";
await page.getByRole("button", { name: "Tailor automatically" }).click();
await page.waitForSelector("text=What changed and why");
check("Success opens the Review tab", (await page.getByRole("tab", { name: /^Review/ }).getAttribute("aria-selected")) === "true");
check("The header shows before and after scores", (await page.locator('[role="img"][aria-label^="Match score after tailoring"]').count()) === 1);
check("A reverted edit is shown with its reason", await page.getByText("Reverted to your original wording").isVisible());
check("The kept edit is shown before and after", (await page.getByText("Cut p95 checkout latency 38% by caching with Redis").first().isVisible()) && (await page.getByText("Reduced p95 checkout latency by 38%").first().isVisible()));
check("It says one line needs review", await page.getByText("1 line need your review").isVisible());

// 3. Tap-to-add skills change the score.
const afterBefore = await ringScore("Match score after tailoring");
await page.getByRole("button", { name: "+ Kubernetes" }).click();
await page.getByRole("button", { name: "+ AWS" }).click();
await page.waitForTimeout(500);
const afterAfter = await ringScore("Match score after tailoring");
check(`Adding two skills raises the after score (${afterBefore} to ${afterAfter})`, afterAfter > afterBefore);
check("Added skills leave the suggestion list", (await page.getByRole("button", { name: "+ Kubernetes" }).count()) === 0);
check("The after score beats the original", afterAfter > scoreBefore, `original ${scoreBefore}`);

// 4. Cover letter.
await page.getByRole("button", { name: "Write a matching cover letter" }).click();
await page.waitForSelector("#letter");
check("The cover letter appears and is editable", (await page.locator("#letter").inputValue()).startsWith("Dear Hiring Manager"));

// 5. Save, then survive a reload.
await page.getByRole("button", { name: "Save this version" }).click();
await page.waitForSelector("text=Saved. Find it on the Saved tab.");
check("Saving shows a confirmation", true);
check("The Saved tab counts it", (await page.getByRole("tab", { name: /^Saved/ }).innerText()).includes("1"));
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("button", { name: "Try an example" }).first().click();
await page.getByRole("tab", { name: /^Saved/ }).click();
check("The saved version is still there after a reload", await page.getByText("Staff Backend Engineer").first().isVisible());
await page.getByRole("button", { name: /Delete saved version/ }).click();
check("Deleting removes it", await page.getByText("No saved versions yet").isVisible());

check("No browser errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
