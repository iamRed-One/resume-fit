"use client";

import type { MatchResult } from "@/lib/match";
import { Banner, Icon } from "./components";

/** What to fix, in order of usefulness: what is missing, which posting lines go unanswered, then what already matches. */
export function GapsPanel({ match, basis, onTailor }: { match: MatchResult; basis: "original" | "tailored"; onTailor: () => void }) {
  const done = match.missing.length === 0;
  return (
    <div className="stack">
      <p className="hint">Based on your {basis} resume. The score is plain matching, not a model, so it is the same every time.</p>

      {done ? (
        <Banner tone="good">Your resume shows every requirement we found in this posting.</Banner>
      ) : (
        <section>
          <h3>Missing from your resume <span className="count">{match.missing.length}</span></h3>
          <p className="hint">Add one only if it is true. Your AI can work them in where your experience supports them.</p>
          <ul className="chips" aria-label="Missing requirements">
            {match.missing.map((t) => (
              <li key={t} className="chip warn">{t}</li>
            ))}
          </ul>
        </section>
      )}

      {match.unanswered.length > 0 && (
        <section>
          <h3>Posting lines you do not answer <span className="count">{match.unanswered.length}</span></h3>
          <ul className="plain">
            {match.unanswered.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </section>
      )}

      {match.matched.length > 0 && (
        <section>
          <h3>Already on your resume <span className="count">{match.matched.length}</span></h3>
          <ul className="chips" aria-label="Matched requirements">
            {match.matched.map((t) => (
              <li key={t} className="chip good">{t}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="cta">
        <button type="button" className="btn btn-primary" onClick={onTailor}>
          Tailor with your AI
          <Icon name="chevron" size={16} />
        </button>
      </div>
    </div>
  );
}
