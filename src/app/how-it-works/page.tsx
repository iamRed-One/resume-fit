import type { Metadata } from "next";
import Link from "next/link";
import { checkGrounding, type GroundingReport } from "@/lib/grounding";
import { analyzeMatch } from "@/lib/match";
import { HONESTY_RULES } from "@/lib/prompt";
import { SAMPLE_POSTING, SAMPLE_RESUME } from "@/lib/sample";
import { SKILLS } from "@/lib/skills";
import { REPO_URL } from "@/lib/site";
import { Icon } from "../components";
import { ThemePicker } from "../theme-picker";

export const metadata: Metadata = {
  title: "How it works · Resume Fit",
  description: "How Resume Fit scores your resume against a job posting, how it tailors the resume without inventing anything, and what happens to your data.",
};

// Everything below that looks like a result is computed by the real code when the site is built, so this
// page cannot drift from what the app actually does.
const match = analyzeMatch(SAMPLE_RESUME, SAMPLE_POSTING);
const total = match.matched.length + match.missing.length;
const skillCount = Math.floor(SKILLS.length / 10) * 10;
const rules = HONESTY_RULES.split("\n").slice(1).map((l) => l.replace(/^- /, ""));

const ORIGINAL_BULLET = "Reduced p95 checkout latency by 38% by adding a Redis cache in front of PostgreSQL";
const EXAMPLES: { wrote: string; source: string; note: string }[] = [
  { wrote: "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL", source: ORIGINAL_BULLET, note: "Reworded, every fact kept." },
  { wrote: "Reduced p95 checkout latency by 52% by adding a Redis cache in front of PostgreSQL", source: ORIGINAL_BULLET, note: "The AI changed the number." },
  { wrote: "Built search with Elasticsearch", source: ORIGINAL_BULLET, note: "A tool that appears nowhere." },
  { wrote: "Ran production services on Kubernetes", source: ORIGINAL_BULLET, note: "A skill the posting wants but your resume never showed." },
  { wrote: "Ran K8s workloads backed by PostgreSQL", source: "Operated Kubernetes clusters and a Postgres database.", note: "Another spelling of skills you already show." },
];

function judge(r: GroundingReport): { label: string; tone: "good" | "warn" | "bad"; why: string } {
  if (r.numbers.length || r.invented.length) {
    const parts = [r.numbers.length && `number not in your resume: ${r.numbers.join(", ")}`, r.invented.length && `not in your resume or the posting: ${r.invented.join(", ")}`].filter(Boolean);
    return { label: "Not supported", tone: "bad", why: parts.join("; ") };
  }
  if (r.unconfirmed.length) return { label: "Confirm", tone: "warn", why: `from the posting, not your resume: ${r.unconfirmed.join(", ")}. Keep it only if it is true.` };
  return { label: "Fine", tone: "good", why: "Nothing added that your resume does not support." };
}
const judged = EXAMPLES.map((e) => ({ ...e, verdict: judge(checkGrounding(e.source, e.wrote, SAMPLE_POSTING)) }));

const CHECKS = [
  ["Keyword coverage", "How much of the posting's weighted requirements your resume shows."],
  ["Impact clarity", "How many bullets state a number or a measurable result."],
  ["Formatting and parsing", "Single column, standard headings, an email address, nothing that looks like a table."],
  ["Leadership signals", "If the posting asks for leadership, whether your bullets show you leading."],
  ["Fits the page", "Word count against one or two pages."],
  ["Every line traces to you", "How many rewritten lines still need your review."],
];

export default function HowItWorks() {
  return (
    <>
      <header className="topbar">
        <Link href="/" className="brand" aria-label="Resume Fit, home">
          <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
            <rect width="64" height="64" rx="14" fill="var(--primary)" />
            <path d="M20 14h16l10 10v26a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="var(--on-primary)" />
            <path d="M24 33h16M24 39h16M24 45h10" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <span>Resume Fit</span>
        </Link>
        <p className="tag" />
        <ThemePicker />
        <Link href="/" className="btn btn-primary btn-sm">
          <Icon name="back" size={16} /> <span className="lbl">Open the app</span>
        </Link>
      </header>

      <main className="article-wrap" id="main">
        <article className="article">
          <h1>How Resume Fit works</h1>
          <p className="lede">
            Resume Fit compares your resume with a job posting, shows you how well they match and what is missing, then helps you tailor the resume, without letting anything be invented.
          </p>

          <nav aria-label="On this page" className="toc">
            <a href="#flow">The flow</a>
            <a href="#score">The match score</a>
            <a href="#tailoring">How tailoring works</a>
            <a href="#check">How we check the result</a>
            <a href="#privacy">Your data</a>
            <a href="#limits">What it cannot do</a>
          </nav>

          <h2 id="flow">The flow</h2>
          <ol className="flow">
            <li><span className="flow-n" aria-hidden>1</span><h3>Add</h3><p>Paste your resume and a posting, or upload a PDF, Word or text file. Files are read in your browser.</p></li>
            <li><span className="flow-n" aria-hidden>2</span><h3>Score</h3><p>You get a match score and a list of what the posting asks for that your resume does not show.</p></li>
            <li><span className="flow-n" aria-hidden>3</span><h3>Tailor</h3><p>Copy a prompt into the AI you already use, or let the app&apos;s server do it with an API key.</p></li>
            <li><span className="flow-n" aria-hidden>4</span><h3>Check</h3><p>We compare the result with your original and flag anything that was made up or left out.</p></li>
            <li><span className="flow-n" aria-hidden>5</span><h3>Use</h3><p>Copy it, download it, print it to PDF, or save a version for that job.</p></li>
          </ol>

          <h2 id="score">How the match score works</h2>
          <p>The score is plain code, not AI, so the same resume and posting always give the same number.</p>
          <ol className="steps">
            <li><strong>Strip the noise.</strong> Equal-opportunity text, pay ranges, benefits and company blurbs are dropped, so an employer&apos;s name is never mistaken for a skill.</li>
            <li><strong>Find the requirements.</strong> A dictionary of about {skillCount} skills and tools, each with its other spellings (k8s is Kubernetes, Postgres is PostgreSQL), plus a few rules for terms it does not know, such as a list after &ldquo;such as&rdquo; or &ldquo;e.g.&rdquo;.</li>
            <li><strong>Weigh them.</strong> A skill under &ldquo;Requirements&rdquo; counts more than one under &ldquo;Nice to have&rdquo;. Soft phrases like &ldquo;cross-functional&rdquo; count less. Everyday words such as &ldquo;pipeline&rdquo; or &ldquo;search&rdquo; only count when the posting is clearly in that field.</li>
            <li><strong>Compare.</strong> The score is the weighted share of those requirements that your resume shows, under any of their spellings.</li>
          </ol>
          <div className="callout">
            <p><strong>A real example.</strong> For the sample resume and posting in the app, the code finds {total} requirements. Your resume shows {match.matched.length} of them and misses {match.missing.length}, so the score is <strong>{match.score}</strong>. The biggest gaps it reports: {match.missing.slice(0, 5).join(", ")}.</p>
          </div>

          <h2 id="tailoring">How tailoring works</h2>
          <p>There are two ways to do the rewrite. Both use the same rules, and both are checked the same way afterwards.</p>
          <h3>Your own AI (no API key)</h3>
          <p>
            Resume Fit writes a prompt for you. It contains your resume, the posting, what already matches, what is missing, the lines of the posting you do not answer yet, and the rules below. You paste it into Claude, ChatGPT, Gemini or any other assistant, then paste the answer back. It costs nothing beyond the chat subscription you already have.
          </p>
          <h3>Automatic (needs an API key)</h3>
          <p>
            The app&apos;s server sends the same rules to Claude and asks for a structured answer: the new resume, a change log, and the skills the posting wants that you do not show. It reverts any edit that fails the check, and can write a matching cover letter.
          </p>
          <h3>The rules the AI is given</h3>
          <ul className="rules">
            {rules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <p>
            A skill from the posting that your resume does not show is never written into the resume. It is listed separately, so you decide whether it is true.
          </p>

          <h2 id="check">How we check the result</h2>
          <p>
            The rules are a request, and an AI can ignore a request. So the result is never trusted. Every changed line is compared with your original resume. Below, each verdict was produced by the real checking code when this page was built.
          </p>
          <ul className="examples">
            {judged.map((e) => (
              <li key={e.wrote} className="example">
                <p className="example-wrote"><span className="diff-tag">AI wrote</span>{e.wrote}</p>
                <p className="hint">{e.note}</p>
                <p><span className={`badge ${e.verdict.tone === "good" ? "pass" : e.verdict.tone === "warn" ? "warn" : "fail"}`}>{e.verdict.label}</span> {e.verdict.why}</p>
              </li>
            ))}
          </ul>
          <p>It also lists figures from your original that the AI silently dropped, and runs a six-part submission check:</p>
          <ul className="checks-list">
            {CHECKS.map(([name, what]) => (
              <li key={name}><strong>{name}.</strong> {what}</li>
            ))}
          </ul>

          <h2 id="privacy">What happens to your data</h2>
          <ul>
            <li><strong>Uploads stay in your browser.</strong> PDF and Word files are read on your device. Nothing is sent to a server to read them.</li>
            <li><strong>The score and the check run in your browser.</strong> No account, no analytics, no tracking.</li>
            <li><strong>Your own AI.</strong> When you paste the prompt into an assistant, that company&apos;s privacy rules apply to what you paste. You choose which one.</li>
            <li><strong>Automatic mode</strong> is the only path that sends your resume and posting to this app&apos;s server, which passes them to the Claude API. It does not store or log them.</li>
            <li><strong>Saved versions and your theme</strong> live in your browser&apos;s local storage and nowhere else.</li>
          </ul>

          <h2 id="limits">What it cannot do</h2>
          <ul>
            <li>It cannot catch an overclaim written in plain words, such as &ldquo;led&rdquo; where you only &ldquo;contributed&rdquo;. It checks numbers, names and tools. Read the changed lines yourself.</li>
            <li>The score is a guide, not a simulation of any employer&apos;s tracking system. It is tuned most for software roles, and thinner for other fields.</li>
            <li>It cannot read a scanned or image-only PDF, and multi-column layouts can come out in the wrong order.</li>
            <li>It cannot make you a better fit. If a posting needs a skill you do not have, the honest result is that the gap stays.</li>
          </ul>

          <h2 id="open">Open source</h2>
          <p>
            Resume Fit is open source. The score, the check and the prompts are all plain, tested code you can read.
            {REPO_URL ? (
              <>
                {" "}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">View the source on GitHub</a>.
              </>
            ) : null}
          </p>
          <p className="cta-row">
            <Link href="/" className="btn btn-primary">Try it with the example</Link>
          </p>
        </article>
      </main>
    </>
  );
}
