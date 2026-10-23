"use client";

import type { MatchResult } from "@/lib/match";
import { ScoreRing, verdict } from "./components";

/**
 * The one thing the user came for, kept on screen: pinned at the top of the results pane on desktop and
 * as a sticky bar on small screens. It never needs scrolling to.
 */
export function ScoreHeader({ before, afterScore, afterSource }: { before: MatchResult | null; afterScore: number | null; afterSource: string | null }) {
  if (!before) {
    return (
      <section className="score is-empty" aria-label="Match score">
        <h2 className="sr-only">Match score</h2>
        <div className="ring-placeholder" aria-hidden />
        <div className="score-text">
          <div className="score-label">No score yet</div>
          <div className="score-sub">Add your resume and a job posting.</div>
        </div>
      </section>
    );
  }
  const shown = afterScore ?? before.score;
  const v = verdict(shown);
  const total = before.matched.length + before.missing.length;
  const delta = afterScore === null ? null : afterScore - before.score;
  return (
    <section className="score" aria-label="Match score" data-tone={v.tone}>
      <h2 className="sr-only">Match score</h2>
      <ScoreRing score={before.score} label="Match score" />
      {afterScore !== null && (
        <>
          <span className="score-arrow" aria-hidden>&rarr;</span>
          <ScoreRing score={afterScore} label="Match score after tailoring" />
        </>
      )}
      <div className="score-text">
        <div className="score-label">
          <span className={`dot ${v.tone}`} aria-hidden />
          {v.label}
          {delta !== null && delta !== 0 && <span className={`delta ${delta > 0 ? "up" : "down"}`}>{delta > 0 ? "+" : ""}{delta}</span>}
        </div>
        <div className="score-sub">
          {afterScore !== null ? `after ${afterSource === "own" ? "your AI's edit" : "tailoring"}` : `${before.matched.length} of ${total} requirements shown`}
          {before.missing.length > 0 && afterScore === null ? ` · ${before.missing.length} missing` : ""}
        </div>
      </div>
    </section>
  );
}
