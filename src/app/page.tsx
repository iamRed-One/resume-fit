"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { analyzeMatch } from "@/lib/match";
import { buildTailorPrompt } from "@/lib/prompt";
import { toPlainText } from "@/lib/resume";
import { reviewReply } from "@/lib/review";
import { runRiskCheck } from "@/lib/risk";
import { SAMPLE_POSTING, SAMPLE_RESUME } from "@/lib/sample";
import type { Prefs } from "@/lib/schemas";
import { Icon, TabPanel, Tabs } from "./components";
import { DocField } from "./doc-field";
import { GapsPanel } from "./gaps-panel";
import { OptionsBar } from "./options-bar";
import { ResumeView } from "./resume-view";
import { ReviewPanel, type AutoResult, type Source } from "./review-panel";
import { SavedPanel } from "./saved-panel";
import { ScoreHeader } from "./score-header";
import { TailorPanel } from "./tailor-panel";
import { ThemePicker } from "./theme-picker";
import type { Letter, SavedVersion, TailorResponse } from "./types";

type Tab = "gaps" | "tailor" | "review" | "saved";
type View = "edit" | "results";

const STORAGE_KEY = "resumefit:versions";
const MIN_CHARS = 50;

function loadVersions(): SavedVersion[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as (Partial<SavedVersion> & { resume?: Parameters<typeof toPlainText>[0] })[];
    // Earlier versions stored a structured resume; they are converted to text on load.
    return raw.map((v) => ({ id: v.id ?? crypto.randomUUID(), savedAt: v.savedAt ?? new Date().toISOString(), jobTitle: v.jobTitle ?? "", company: v.company ?? "", score: v.score ?? 0, text: v.text ?? (v.resume ? toPlainText(v.resume) : "") })).filter((v) => v.text);
  } catch {
    return [];
  }
}

function storeVersions(v: SavedVersion[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  } catch {
    /* storage can be blocked; saving is a convenience, not a requirement */
  }
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
  return data as T;
}

function Logo() {
  return (
    <svg width="26" height="26" viewBox="0 0 64 64" aria-hidden>
      <rect width="64" height="64" rx="14" fill="var(--primary)" />
      <path d="M20 14h16l10 10v26a2 2 0 0 1-2 2H20a2 2 0 0 1-2-2V16a2 2 0 0 1 2-2z" fill="var(--on-primary)" />
      <path d="M24 33h16M24 39h16M24 45h10" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Page() {
  const [resumeText, setResumeText] = useState("");
  const [jdText, setJdText] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [prefs, setPrefs] = useState<Prefs>({ pages: 1, tone: "standard professional", intensity: "balanced" });

  const [reply, setReply] = useState("");
  const [tailored, setTailored] = useState<TailorResponse | null>(null);
  const [letter, setLetter] = useState<Letter | null>(null);
  const [busy, setBusy] = useState<"tailor" | "letter" | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [source, setSource] = useState<Source | null>(null);

  const [tab, setTab] = useState<Tab>("gaps");
  const [view, setView] = useState<View>("edit");
  const [versions, setVersions] = useState<SavedVersion[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => setVersions(loadVersions()), []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  function say(message: string) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  // Typing stays instant; the analysis follows a beat behind instead of blocking each keystroke.
  const dResume = useDeferredValue(resumeText);
  const dJd = useDeferredValue(jdText);
  const ready = dResume.trim().length >= MIN_CHARS && dJd.trim().length >= MIN_CHARS;

  const before = useMemo(() => (ready ? analyzeMatch(dResume, dJd) : null), [ready, dResume, dJd]);
  const prompt = useMemo(() => (before ? buildTailorPrompt({ resumeText: dResume, jdText: dJd, match: before, prefs }) : ""), [before, dResume, dJd, prefs]);
  const own = useMemo(
    () => (ready && reply.trim().length >= MIN_CHARS ? reviewReply({ resumeText: dResume, jdText: dJd, reply, pages: prefs.pages }) : null),
    [ready, reply, dResume, dJd, prefs.pages],
  );
  const auto = useMemo<AutoResult | null>(() => {
    if (!tailored || !ready) return null;
    const text = toPlainText(tailored.resume);
    const after = analyzeMatch(text, dJd);
    const risk = runRiskCheck({ resumeText: text, jdText: dJd, matchScore: after.score, pages: prefs.pages, untraceableLines: tailored.flagged });
    return { tailored, after, risk };
  }, [tailored, ready, dJd, prefs.pages]);

  const shown: Source | null = source === "own" && own ? "own" : source === "auto" && auto ? "auto" : own ? "own" : auto ? "auto" : null;
  const afterScore = shown === "own" ? own!.after.score : shown === "auto" ? auto!.after.score : null;
  const gaps = shown === "own" ? own!.after : shown === "auto" ? auto!.after : before;

  // The first time a usable reply is pasted, take the user to the check.
  const hadOwn = useRef(false);
  useEffect(() => {
    if (own && !hadOwn.current) {
      setSource("own");
      setTab("review");
    }
    hadOwn.current = own !== null;
  }, [own]);

  const baseName = (jobTitle || company || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";

  function loadExample() {
    setResumeText(SAMPLE_RESUME);
    setJdText(SAMPLE_POSTING);
    setJobTitle("Staff Backend Engineer");
    setCompany("Fabrikam");
    setReply("");
    setTailored(null);
    setLetter(null);
    setSource(null);
    setTab("gaps");
    setView("results");
  }

  async function onAuto() {
    setBusy("tailor");
    setAutoError(null);
    setLetter(null);
    try {
      setTailored(await post<TailorResponse>("/api/tailor", { resumeText, jdText, prefs }));
      setSource("auto");
      setTab("review");
    } catch (e) {
      setAutoError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function onLetter() {
    if (!tailored) return;
    setBusy("letter");
    try {
      setLetter(await post("/api/cover-letter", { resume: tailored.resume, jdText, company: company || undefined, jobTitle: jobTitle || undefined }));
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not write the letter.");
    } finally {
      setBusy(null);
    }
  }

  function addSkill(skill: string) {
    if (!tailored) return;
    setTailored({ ...tailored, resume: { ...tailored.resume, skills: [...tailored.resume.skills, skill] }, suggestedSkills: tailored.suggestedSkills.filter((s) => s !== skill) });
  }

  function save(text: string) {
    const next = [{ id: crypto.randomUUID(), savedAt: new Date().toISOString(), jobTitle, company, score: afterScore ?? before?.score ?? 0, text }, ...versions];
    setVersions(next);
    storeVersions(next);
    say("Saved. Find it on the Saved tab.");
  }

  function removeVersion(id: string) {
    const next = versions.filter((v) => v.id !== id);
    setVersions(next);
    storeVersions(next);
  }

  const reviewBadge = own ? own.flagged.length : auto ? auto.tailored.flagged : 0;

  return (
    <>
      <a className="skip" href="#results">Skip to results</a>
      <header className="topbar">
        <h1 className="brand"><Logo /> <span>Resume Fit</span></h1>
        <p className="tag">See how you match, then tailor without inventing anything.</p>
        <Link href="/how-it-works" className="btn btn-quiet btn-sm" aria-label="How it works">
          <Icon name="help" size={16} /> <span className="lbl">How it works</span>
        </Link>
        <ThemePicker />
        <button type="button" className="btn btn-quiet btn-sm" onClick={loadExample} aria-label="Try an example">
          <Icon name="spark" size={16} /> <span className="lbl">Try an example</span>
        </button>
      </header>

      <main className="workspace" data-view={view}>
        <ScoreHeader before={before} afterScore={afterScore} afterSource={shown} />

        <section className="docs" aria-label="Your documents">
          <h2 className="sr-only">Your documents</h2>
          <OptionsBar jobTitle={jobTitle} company={company} prefs={prefs} onTitle={setJobTitle} onCompany={setCompany} onPrefs={setPrefs} />
          <div className="docs-pair">
            <DocField id="resume" label="Your resume" what="resume" value={resumeText} onChange={setResumeText} placeholder="Paste your resume here, or upload a PDF, Word or text file." />
            <DocField id="jd" label="Job posting" what="job posting" value={jdText} onChange={setJdText} placeholder="Paste the job description here, or upload it." />
          </div>
          <p className="privacy">Uploads are read in your browser and never sent anywhere.</p>
        </section>

        <section id="results" className="results" aria-label="Results" tabIndex={-1}>
          <h2 className="sr-only">Results</h2>
          {!before ? (
            <div className="empty">
              <h2>See how you match</h2>
              <ol>
                <li>Add your resume and a job posting. Paste them or upload a file.</li>
                <li>Your match score appears at the top, with what is missing.</li>
                <li>Copy a prompt into your own AI, paste its answer back, and we check it.</li>
              </ol>
              <button type="button" className="btn btn-primary" onClick={loadExample}>
                <Icon name="spark" size={16} /> <span>Try an example</span>
              </button>
            </div>
          ) : (
            <>
              <Tabs<Tab>
                id="res"
                value={tab}
                onChange={setTab}
                tabs={[
                  { id: "gaps", label: <>Gaps{gaps && gaps.missing.length > 0 && <span className="pill">{gaps.missing.length}</span>}</> },
                  { id: "tailor", label: "Tailor" },
                  { id: "review", label: <>Review{reviewBadge > 0 && <span className="pill warn" aria-label={`${reviewBadge} to check`}>{reviewBadge}</span>}</> },
                  { id: "saved", label: <>Saved{versions.length > 0 && <span className="pill">{versions.length}</span>}</> },
                ]}
              />
              <TabPanel id="res" tab="gaps" active={tab === "gaps"}>
                {gaps && <GapsPanel match={gaps} basis={shown ? "tailored" : "original"} onTailor={() => setTab("tailor")} />}
              </TabPanel>
              <TabPanel id="res" tab="tailor" active={tab === "tailor"}>
                <TailorPanel prompt={prompt} reply={reply} onReply={setReply} onAuto={onAuto} autoBusy={busy === "tailor"} autoError={autoError} />
              </TabPanel>
              <TabPanel id="res" tab="review" active={tab === "review"}>
                <ReviewPanel
                  source={shown}
                  hasOwn={own !== null}
                  hasAuto={auto !== null}
                  onSource={setSource}
                  own={own}
                  auto={auto}
                  letter={letter}
                  letterBusy={busy === "letter"}
                  onLetter={onLetter}
                  onLetterText={(t) => letter && setLetter({ ...letter, text: t })}
                  onAddSkill={addSkill}
                  onSave={save}
                  fileName={baseName}
                  goTailor={() => setTab("tailor")}
                />
              </TabPanel>
              <TabPanel id="res" tab="saved" active={tab === "saved"}>
                <SavedPanel versions={versions} onDelete={removeVersion} />
              </TabPanel>
            </>
          )}
        </section>
      </main>

      <nav className="bottombar" aria-label="Switch between documents and results">
        <button type="button" aria-pressed={view === "edit"} onClick={() => setView("edit")}>
          <Icon name="file" /> <span>Documents</span>
        </button>
        <button type="button" aria-pressed={view === "results"} onClick={() => setView("results")}>
          <Icon name="spark" /> <span>Results</span>
        </button>
      </nav>

      <div className="toast-region" role="status" aria-live="polite">
        {toast && <div className="toast">{toast}</div>}
      </div>

      {own && (
        <div className="print-sheet own" aria-hidden>
          <pre className="prewrap">{own.parsed.resumeText}</pre>
        </div>
      )}
      {tailored && (
        <div className="print-sheet api" aria-hidden>
          <ResumeView resume={tailored.resume} />
        </div>
      )}
    </>
  );
}
