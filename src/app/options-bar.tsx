"use client";

import { useState } from "react";
import type { Prefs } from "@/lib/schemas";
import { Icon } from "./components";

const TONES: { value: Prefs["tone"]; label: string }[] = [
  { value: "standard professional", label: "Professional" },
  { value: "confident", label: "Confident" },
  { value: "warm", label: "Warm" },
  { value: "concise", label: "Concise" },
];
const AMOUNTS: { value: Prefs["intensity"]; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "balanced", label: "Balanced" },
  { value: "complete", label: "Complete" },
];

/**
 * Sits above the editors. On a wide screen all five fields are visible in one row; on a smaller one it
 * folds into a single row showing the current choices, and unfolds in place.
 */
export function OptionsBar({ jobTitle, company, prefs, onTitle, onCompany, onPrefs }: { jobTitle: string; company: string; prefs: Prefs; onTitle: (v: string) => void; onCompany: (v: string) => void; onPrefs: (p: Prefs) => void }) {
  const [open, setOpen] = useState(false);
  const now = `${prefs.pages} page${prefs.pages > 1 ? "s" : ""} · ${TONES.find((t) => t.value === prefs.tone)?.label} · ${AMOUNTS.find((a) => a.value === prefs.intensity)?.label}`;
  return (
    <section className="options" data-open={open} aria-label="Options">
      <button type="button" className="options-toggle" aria-expanded={open} aria-controls="options-fields" onClick={() => setOpen(!open)}>
        <span className="options-title">Options</span>
        <span className="options-now">{now}</span>
        <Icon name="chevron" size={16} />
      </button>
      <div id="options-fields" className="fields">
        <div><label htmlFor="title">Job title</label><input id="title" value={jobTitle} onChange={(e) => onTitle(e.target.value)} maxLength={120} autoComplete="off" placeholder="Optional" /></div>
        <div><label htmlFor="company">Company</label><input id="company" value={company} onChange={(e) => onCompany(e.target.value)} maxLength={120} autoComplete="off" placeholder="Optional" /></div>
        <div><label htmlFor="pages">Length</label>
          <select id="pages" value={prefs.pages} onChange={(e) => onPrefs({ ...prefs, pages: Number(e.target.value) as 1 | 2 })}><option value={1}>1 page</option><option value={2}>2 pages</option></select></div>
        <div><label htmlFor="tone">Tone</label>
          <select id="tone" value={prefs.tone} onChange={(e) => onPrefs({ ...prefs, tone: e.target.value as Prefs["tone"] })}>{TONES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label htmlFor="intensity">Changes</label>
          <select id="intensity" value={prefs.intensity} onChange={(e) => onPrefs({ ...prefs, intensity: e.target.value as Prefs["intensity"] })}>{AMOUNTS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select></div>
      </div>
    </section>
  );
}
