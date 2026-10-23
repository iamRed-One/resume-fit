// Snapshots one public job posting per job function from Greenhouse's public board API,
// which companies publish for exactly this kind of read. Output is for local evaluation only.
//   node evals/fetch-postings.mjs           -> evals/data/postings (the tuning set)
//   node evals/fetch-postings.mjs --blind   -> evals/data/blind    (a separate set, never used to tune)
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BLIND = process.argv.includes("--blind");
const BOARDS = BLIND
  ? ["mongodb", "okta", "twilio", "elastic", "robinhood", "pinterest", "lyft", "samsara", "brex", "gusto", "vercel", "stripe", "airbnb", "datadog", "figma", "gitlab", "cloudflare", "coinbase"]
  : ["stripe", "airbnb", "datadog", "figma", "asana", "gitlab", "cloudflare", "coinbase", "instacart", "reddit", "duolingo", "toast"];

// How many postings per category in blind mode (software-heavy, as asked).
const BLIND_COUNTS = {
  "swe-backend": 6, "swe-frontend": 4, "swe-fullstack": 4, "swe-mobile": 3, "swe-infra-sre": 4, "swe-data-ml": 4,
  "swe-security": 2, "swe-staff": 2, "swe-eng-manager": 2,
  "product-manager": 2, "product-designer": 2, "data-analyst": 2, "account-executive": 2, "customer-support": 2,
  "recruiter": 2, "finance-accounting": 1, "marketing": 1,
};

// Software roles dominate on purpose: that is where this tool is aimed. Non-software roles are
// kept as a smaller set so the extractor is not tuned only to engineering vocabulary.
// Selection is deterministic: rotated board order, lowest job id, title match, no stubs.
const IC = /\b(manager|director|head of|vp|vice president|principal|intern)\b/i;
const CATEGORIES = {
  // --- software (group "swe") ---
  "swe-backend": { group: "swe", count: 3, re: /\b(backend|back-end|software engineer)\b/i, exclude: IC },
  "swe-frontend": { group: "swe", count: 2, re: /\b(front-?end|web engineer|ui engineer)\b/i, exclude: IC },
  "swe-fullstack": { group: "swe", count: 2, re: /\bfull[- ]?stack\b/i, exclude: IC },
  "swe-mobile": { group: "swe", count: 2, re: /\b(ios|android|mobile) (software )?engineer\b/i, exclude: IC },
  "swe-infra-sre": { group: "swe", count: 2, re: /\b(site reliability|sre|devops|infrastructure engineer|platform engineer)\b/i, exclude: IC },
  "swe-data-ml": { group: "swe", count: 2, re: /\b(data engineer|machine learning engineer|ml engineer|applied scientist)\b/i, exclude: IC },
  "swe-security": { group: "swe", count: 1, re: /\bsecurity engineer\b/i, exclude: IC },
  "swe-staff": { group: "swe", count: 2, re: /\b(staff|senior staff) (software )?engineer\b/i, exclude: /\b(manager|director|head of|vp|intern)\b/i },
  "swe-eng-manager": { group: "swe", count: 1, re: /\bengineering manager\b/i, exclude: /\b(director|vp|intern)\b/i },
  // --- everything else (group "other") ---
  "product-manager": { group: "other", count: 1, re: /\bproduct manager\b/i, exclude: /\b(director|head of|vp)\b/i },
  "product-designer": { group: "other", count: 1, re: /\b(product designer|ux designer|ui designer)\b/i, exclude: IC },
  "data-analyst": { group: "other", count: 1, re: /\b(data analyst|analytics engineer|business intelligence analyst)\b/i, exclude: IC },
  "account-executive": { group: "other", count: 1, re: /\baccount executive\b/i, exclude: /\b(director|head of|vp)\b/i },
  "customer-support": { group: "other", count: 1, re: /\b(support (specialist|agent|engineer)|customer support)\b/i, exclude: IC },
  "recruiter": { group: "other", count: 1, re: /\b(recruiter|sourcer)\b/i, exclude: /\b(director|head of|vp)\b/i },
  "finance-accounting": { group: "other", count: 1, re: /\b(accountant|financial analyst|fp&a|accounting)\b/i, exclude: /\b(director|head of|vp)\b/i },
  "marketing": { group: "other", count: 1, re: /\b(marketing manager|content marketing|product marketing|growth marketing)\b/i, exclude: /\b(director|head of|vp)\b/i },
};

const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " ", "&rsquo;": "'", "&lsquo;": "'", "&ndash;": "-", "&mdash;": "-", "&ldquo;": '"', "&rdquo;": '"' };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp|rsquo|lsquo|ndash|mdash|ldquo|rdquo);/g, (m) => entities[m]);

function htmlToText(html) {
  // The API returns HTML that is itself entity-escaped, so decode once, then strip tags, then decode again.
  return decode(
    decode(html)
      .replace(/<\s*li[^>]*>/gi, "\n- ")
      .replace(/<\s*\/\s*(p|div|h[1-6]|ul|ol|li)\s*>/gi, "\n")
      .replace(/<\s*br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function json(url) {
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

const outDir = path.join(import.meta.dirname, "data", BLIND ? "blind" : "postings");
await mkdir(outDir, { recursive: true });

// Blind mode never reuses a posting from the tuning set.
const used = new Set();
if (BLIND) {
  const dir = path.join(import.meta.dirname, "data", "postings");
  for (const file of await readdir(dir)) {
    const m = /^Source: .*?(\d{6,})/m.exec(await readFile(path.join(dir, file), "utf8"));
    if (m) used.add(Number(m[1]));
  }
}
const lists = Object.fromEntries(await Promise.all(BOARDS.map(async (b) => [b, (await json(`https://boards-api.greenhouse.io/v1/boards/${b}/jobs`)).jobs])));
const today = new Date().toISOString().slice(0, 10);

let saved = 0;
for (const [index, [category, { group, count, re, exclude }]] of Object.entries(CATEGORIES).entries()) {
  for (let n = 1; n <= (BLIND ? (BLIND_COUNTS[category] ?? count) : count); n++) {
    // Rotate the starting board per posting so they come from a spread of companies, not one house style.
    const start = (index + n * 3 + (BLIND ? 5 : 0)) % BOARDS.length;
    const order = [...BOARDS.slice(start), ...BOARDS.slice(0, start)];
    let found = false;
    for (const board of order) {
      const candidates = lists[board].filter((j) => re.test(j.title) && !exclude.test(j.title) && !used.has(j.id)).sort((a, b) => a.id - b.id);
      for (const job of candidates.slice(0, 5)) {
        const detail = await json(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs/${job.id}`);
        const body = htmlToText(detail.content ?? "");
        if (body.length < 1500) continue; // skip stubs
        used.add(job.id);
        const name = `${category}-${n}`;
        const header = `Title: ${detail.title}\nCompany: ${board}\nGroup: ${group}\nSource: ${detail.absolute_url}\nFetched: ${today}\n\n`;
        await writeFile(path.join(outDir, `${name}.txt`), header + body + "\n");
        console.log(`${name.padEnd(22)} ${board.padEnd(10)} ${detail.title} (${body.length} chars)`);
        found = true;
        saved++;
        break;
      }
      if (found) break;
    }
    if (!found) console.log(`${(category + "-" + n).padEnd(22)} NO MATCH`);
  }
}
console.log(`\n${saved} postings saved to ${outDir}`);
