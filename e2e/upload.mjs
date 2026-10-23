// Drives a real browser through the upload feature. Unit tests run in Node and cannot catch bundling
// problems in the browser build (this once failed only there), so this complements tests/extract.test.ts.
//
//   npm run build && npx next start -p 3000      (in another terminal)
//   npm run e2e:upload                           (or: node e2e/upload.mjs http://localhost:3000)
//
// Set CHROME_PATH if Chrome or Chromium is not in a standard location. Nothing is downloaded.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { chromium } from "playwright-core";

const APP = process.argv[2] ?? "http://localhost:3000/";
const FILES = path.join(import.meta.dirname, "..", "tests", "files");
const TMP = mkdtempSync(path.join(tmpdir(), "resume-fit-e2e-"));

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

// A Word document with a real bullet list, a posting with no bullets, and a file that must be refused.
async function makeDocx() {
  const zip = new JSZip();
  const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8"?><w:numbering ${ns}><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  const p = (t) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
  const li = (t) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8"?><w:document ${ns}><w:body>${p("Aisha Rahman")}${p("aisha.rahman@example.com")}${p("Skills")}${p("Python, PyTorch, SQL, Airflow, AWS")}${p("Experience")}${li("Built a fraud model in XGBoost that flagged 31% more fraudulent claims")}${li("Designed the feature pipeline in Spark processing 40 million records a night")}${p("Education")}${p("M.Sc. Statistics, University of Waterloo, 2020")}</w:body></w:document>`);
  const out = path.join(TMP, "resume.docx");
  writeFileSync(out, await zip.generateAsync({ type: "uint8array" }));
  return out;
}
const docx = await makeDocx();
const posting = path.join(TMP, "posting.txt");
writeFileSync(posting, "Senior Machine Learning Engineer\n\nWe are looking for an engineer who has shipped machine learning models to production using Python and PyTorch.\nYou will build data pipelines with Spark and Airflow on AWS and deploy models with Docker and Kubernetes.\nExperience with MLOps and monitoring model drift is a strong plus for this role.\n");
const oldDoc = path.join(TMP, "old.doc");
writeFileSync(oldDoc, "not really a word file");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  ->  " + detail : ""}`);
};

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage();
const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
const requests = [];
page.on("request", (r) => requests.push({ method: r.method(), url: r.url() }));
await page.goto(APP, { waitUntil: "networkidle" });
const origin = new URL(APP).origin;
const sentBefore = requests.length;

const resumeBox = page.locator("#resume");
const resumeUpload = page.locator('input[aria-label="Upload your resume"]');
const jdUpload = page.locator('input[aria-label="Upload your job posting"]');
const status = (n) => page.locator('[role="status"]').nth(n);

await resumeUpload.setInputFiles(path.join(FILES, "resume-sample.pdf"));
await page.waitForFunction(() => document.querySelector("#resume").value.includes("Jordan Rivera"), null, { timeout: 30000 });
let v = await resumeBox.inputValue();
check("PDF: text lands in the resume box", v.includes("Senior Software Engineer, Northwind Payments"));
check("PDF: a wrapped bullet is rejoined", v.includes("in front of PostgreSQL"));
check("PDF: notice names the file and pages", /Read resume-sample\.pdf \(1 page, \d+ words\)/.test(await status(0).innerText()));

await resumeUpload.setInputFiles(docx);
await page.waitForFunction(() => document.querySelector("#resume").value.includes("Aisha Rahman"), null, { timeout: 30000 });
v = await resumeBox.inputValue();
check("Word: bullets survive as '- '", v.includes("- Built a fraud model in XGBoost") && v.includes("- Designed the feature pipeline in Spark"));
check("Word: replaces the previous resume", !v.includes("Jordan Rivera"));

await jdUpload.setInputFiles(posting);
await page.waitForFunction(() => document.querySelector("#jd").value.includes("Senior Machine Learning Engineer"), null, { timeout: 15000 });
await page.waitForSelector('[role="img"][aria-label^="Match score"]', { timeout: 15000 });
const matched = await page.getByRole("list", { name: "Matched requirements" }).innerText();
check("Both uploaded: the score reflects the uploaded resume", /Python/.test(matched) && /PyTorch/.test(matched) && /AWS/.test(matched), matched.replace(/\n/g, ", "));

const before = await resumeBox.inputValue();
await resumeUpload.setInputFiles(path.join(FILES, "no-text.pdf"));
await page.waitForFunction(() => /No selectable text/.test(document.body.innerText), null, { timeout: 15000 });
check("Scanned PDF: clear message, existing text untouched", (await resumeBox.inputValue()) === before);
await resumeUpload.setInputFiles(oldDoc);
await page.waitForFunction(() => /Old \.doc files are not supported/.test(document.body.innerText), null, { timeout: 15000 });
check(".doc: explains how to convert", true);

const b64 = readFileSync(posting).toString("base64");
const dt = await page.evaluateHandle(([data]) => {
  const t = new DataTransfer();
  t.items.add(new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], "dropped.txt", { type: "text/plain" }));
  return t;
}, [b64]);
await page.locator(".doc").nth(1).dispatchEvent("drop", { dataTransfer: dt });
await page.waitForFunction(() => /Read dropped\.txt/.test(document.body.innerText), null, { timeout: 15000 });
check("Drag and drop: file is read", true);

const leaving = requests.slice(sentBefore).filter((r) => (r.method !== "GET" && r.method !== "HEAD") || !r.url.startsWith(origin));
check("Privacy: no upload request and no request to another origin", leaving.length === 0, leaving.map((r) => `${r.method} ${r.url}`).join(", "));
check("No browser errors", problems.length === 0, problems.join(" | ").slice(0, 300));

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
