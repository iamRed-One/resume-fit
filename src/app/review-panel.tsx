"use client";

import type { MatchResult } from "@/lib/match";
import { toMarkdown, toPlainText } from "@/lib/resume";
import type { Review } from "@/lib/review";
import type { RiskReport } from "@/lib/risk";
import { Banner, CopyButton, Icon, RiskView, download, printSheet } from "./components";
import type { Letter, TailorResponse } from "./types";

export type Source = "own" | "auto";

export interface AutoResult {
  tailored: TailorResponse;
  after: MatchResult;
  risk: RiskReport;
}

function ExportBar({ text, markdown, fileName, print, onSave }: { text: string; markdown?: string; fileName: string; print: "own" | "api"; onSave: () => void }) {
  return (
    <div className="exportbar" role="group" aria-label="Use this resume">
      <CopyButton text={text} label="Copy resume" className="btn btn-primary" />
      {/* On a phone the secondary actions shrink to icons (labelled for assistive tech and as tooltips). */}
      <button type="button" className="btn" onClick={() => download(`${fileName}.txt`, text, "text/plain")} aria-label="Download as plain text" title="Download .txt">
        <Icon name="download" /> <span className="lbl">.txt</span>
      </button>
      <button type="button" className="btn hide-sm" onClick={() => download(`${fileName}.md`, markdown ?? text, "text/markdown")} aria-label="Download as Markdown" title="Download .md">
        <Icon name="download" /> <span className="lbl">.md</span>
      </button>
      <button type="button" className="btn" onClick={() => printSheet(print)} aria-label="Print or save as PDF" title="Print or save as PDF">
        <Icon name="print" /> <span className="lbl">PDF</span>
      </button>
      <button type="button" className="btn btn-quiet" onClick={onSave} aria-label="Save this version" title="Save this version">
        <Icon name="bookmark" /> <span className="lbl">Save</span>
      </button>
    </div>
  );
}

function OwnReview({ r }: { r: Review }) {
  const violations = r.flagged.filter((f) => f.kind === "violation");
  const confirms = r.flagged.filter((f) => f.kind === "confirm");
  return (
    <div className="stack">
      {violations.length > 0 ? (
        <Banner tone="bad" live>
          {violations.length} line{violations.length > 1 ? "s add" : " adds"} something your resume does not support. Fix or remove {violations.length > 1 ? "them" : "it"} before you send this.
        </Banner>
      ) : confirms.length > 0 ? (
        <Banner tone="warn" live>{confirms.length} line{confirms.length > 1 ? "s use" : " uses"} a skill from the posting that is not on your resume. Keep only what is true.</Banner>
      ) : r.changedLines === 0 ? (
        <Banner tone="warn" live>The reply matches your original resume. Nothing was changed.</Banner>
      ) : (
        <Banner tone="good" live>No changed line adds a number, employer or tool that your resume does not support.</Banner>
      )}

      {r.flagged.map((f, i) => (
        <article className="flag" key={i} data-kind={f.kind}>
          <span className={`badge ${f.kind === "violation" ? "reverted" : "needs-review"}`}>{f.kind === "violation" ? "not supported" : "confirm"}</span>
          <p className="flag-text">{f.text}</p>
          <p className="flag-why">{f.problems.join("; ")}</p>
        </article>
      ))}

      {r.droppedNumbers.length > 0 && (
        <Banner tone="warn" live>The reply left out figures from your original: {r.droppedNumbers.join(", ")}. Make sure that was on purpose.</Banner>
      )}

      {r.after.missing.length > 0 && (
        <section>
          <h3>Still missing <span className="count">{r.after.missing.length}</span></h3>
          <ul className="chips">{r.after.missing.map((t) => <li key={t} className="chip warn">{t}</li>)}</ul>
        </section>
      )}
      {r.parsed.couldNotAdd.length > 0 && (
        <section>
          <h3>Skills the AI says you do not show</h3>
          <p className="hint">Add one yourself only if it is true.</p>
          <ul className="chips">{r.parsed.couldNotAdd.map((t) => <li key={t} className="chip warn">{t}</li>)}</ul>
        </section>
      )}

      <section>
        <h3>Submission risk check <span className={`badge ${r.risk.overall}`}>{r.risk.overall}</span></h3>
        <RiskView report={r.risk} />
      </section>

      {r.parsed.changesText && (
        <details className="disclose">
          <summary>What the AI says it changed and why</summary>
          <pre className="prewrap">{r.parsed.changesText}</pre>
        </details>
      )}
    </div>
  );
}

function AutoReview({
  auto,
  letter,
  letterBusy,
  onLetter,
  onLetterText,
  onAddSkill,
  fileName,
}: {
  auto: AutoResult;
  letter: Letter | null;
  letterBusy: boolean;
  onLetter: () => void;
  onLetterText: (t: string) => void;
  onAddSkill: (s: string) => void;
  fileName: string;
}) {
  const { tailored, risk } = auto;
  return (
    <div className="stack">
      {tailored.flagged > 0 ? (
        <Banner tone="warn" live>{tailored.flagged} line{tailored.flagged > 1 ? "s" : ""} need your review. Check the changes below before you send this.</Banner>
      ) : (
        <Banner tone="good" live>Every change is supported by your original resume.</Banner>
      )}

      {tailored.suggestedSkills.length > 0 && (
        <section>
          <h3>Skills the posting asks for</h3>
          <p className="hint">Tap only the ones you really have. We never add a skill for you.</p>
          <ul className="chips">
            {tailored.suggestedSkills.map((s) => (
              <li key={s}>
                <button type="button" className="chip warn chip-btn" onClick={() => onAddSkill(s)}>+ {s}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3>What changed and why <span className="count">{tailored.changeLog.length}</span></h3>
        {tailored.changeLog.length === 0 && <p className="hint">The resume came back unchanged.</p>}
        {tailored.changeLog.map((c, i) => (
          <article className="change" key={i}>
            <div className="change-head">
              <span className={`badge ${c.status}`}>{c.status.replace("-", " ")}</span>
              <span>{c.section}</span>
              <span>Answers <strong>{c.requirement}</strong></span>
            </div>
            {c.before && <p className="diff before"><span className="diff-tag">Before</span>{c.before}</p>}
            <p className="diff after"><span className="diff-tag">After</span>{c.after}</p>
            <p>{c.reason}</p>
            {c.note && <p className="flag-why">{c.note}</p>}
          </article>
        ))}
        {tailored.warnings.length > 0 && (
          <>
            <h3>Lines to check that were not logged as changes</h3>
            {tailored.warnings.map((w, i) => (
              <article className="flag" data-kind="violation" key={i}>
                <p className="flag-text">{w.text}</p>
                <p className="flag-why">{w.problems.join("; ")}</p>
              </article>
            ))}
          </>
        )}
      </section>

      <section>
        <h3>Submission risk check <span className={`badge ${risk.overall}`}>{risk.overall}</span></h3>
        <RiskView report={risk} />
      </section>

      <section>
        <h3>Cover letter</h3>
        {!letter ? (
          <button type="button" className="btn" onClick={onLetter} disabled={letterBusy}>{letterBusy ? "Writing..." : "Write a matching cover letter"}</button>
        ) : (
          <>
            {!letter.grounding.ok && (
              <Banner tone="warn" live>
                Check the letter before sending:{" "}
                {[letter.grounding.numbers.length ? `numbers not in your resume (${letter.grounding.numbers.join(", ")})` : "", letter.grounding.invented.length ? `terms not in your resume or the posting (${letter.grounding.invented.join(", ")})` : ""].filter(Boolean).join("; ")}.
              </Banner>
            )}
            <label htmlFor="letter" className="sr-only">Cover letter</label>
            <textarea id="letter" className="letter" value={letter.text} onChange={(e) => onLetterText(e.target.value)} />
            <div className="actions">
              <CopyButton text={letter.text} label="Copy letter" />
              <button type="button" className="btn" onClick={() => download(`${fileName}-cover-letter.txt`, letter.text, "text/plain")}><Icon name="download" /> <span>.txt</span></button>
              <button type="button" className="btn btn-quiet" onClick={onLetter} disabled={letterBusy}>{letterBusy ? "Writing..." : "Write again"}</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

export function ReviewPanel(props: {
  source: Source | null;
  hasOwn: boolean;
  hasAuto: boolean;
  onSource: (s: Source) => void;
  own: Review | null;
  auto: AutoResult | null;
  letter: Letter | null;
  letterBusy: boolean;
  onLetter: () => void;
  onLetterText: (t: string) => void;
  onAddSkill: (s: string) => void;
  onSave: (text: string) => void;
  fileName: string;
  goTailor: () => void;
}) {
  const { source, own, auto } = props;
  if (!source || (source === "own" && !own) || (source === "auto" && !auto)) {
    return (
      <div className="empty-inline">
        <p>Nothing to review yet.</p>
        <p className="hint">Paste your AI&apos;s reply on the Tailor tab and the check appears here.</p>
        <button type="button" className="btn btn-primary" onClick={props.goTailor}>Go to Tailor</button>
      </div>
    );
  }
  const text = source === "own" ? own!.parsed.resumeText : toPlainText(auto!.tailored.resume);
  return (
    <div className="review">
      {props.hasOwn && props.hasAuto && (
        <div className="segmented" role="group" aria-label="Which result to review">
          <button type="button" aria-pressed={source === "own"} onClick={() => props.onSource("own")}>Your AI</button>
          <button type="button" aria-pressed={source === "auto"} onClick={() => props.onSource("auto")}>Automatic</button>
        </div>
      )}
      {source === "own" ? (
        <OwnReview r={own!} />
      ) : (
        <AutoReview auto={auto!} letter={props.letter} letterBusy={props.letterBusy} onLetter={props.onLetter} onLetterText={props.onLetterText} onAddSkill={props.onAddSkill} fileName={props.fileName} />
      )}
      <ExportBar
        text={text}
        markdown={source === "auto" ? toMarkdown(auto!.tailored.resume) : undefined}
        fileName={props.fileName}
        print={source === "own" ? "own" : "api"}
        onSave={() => props.onSave(text)}
      />
    </div>
  );
}
