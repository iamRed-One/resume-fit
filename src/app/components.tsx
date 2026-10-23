"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { RiskReport } from "@/lib/risk";

// ------------------------------------------------------------------ icons
// One stroke width and one size scale across the app (ui-ux-pro-max: icon-style-consistent).
const PATHS = {
  upload: "M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3",
  copy: "M9 9h9a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zM5 15V6a1 1 0 0 1 1-1h9",
  check: "M5 12.5l4.5 4.5L19 7.5",
  download: "M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5M4 20h16",
  print: "M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2M7 14h10v6H7z",
  x: "M6 6l12 12M18 6L6 18",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  file: "M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z",
  alert: "M12 8v5m0 3.5v.01M10.3 4.2L3 17.5a1.5 1.5 0 0 0 1.3 2.2h15.4a1.5 1.5 0 0 0 1.3-2.2L13.7 4.2a1.5 1.5 0 0 0-2.6 0z",
  chevron: "M9 6l6 6-6 6",
  bookmark: "M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1z",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.6 9.4a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1 .8-1 1.6M12 16.8v.01",
  back: "M15 6l-6 6 6 6",
} as const;

export function Icon({ name, size = 18 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ---------------------------------------------------------------- score
export type Verdict = { label: string; tone: "good" | "warn" | "bad" };

/** Words next to the number, so colour is never the only signal (ui-ux-pro-max: color-not-only). */
export function verdict(score: number): Verdict {
  if (score >= 70) return { label: "Strong match", tone: "good" };
  if (score >= 45) return { label: "Partial match", tone: "warn" };
  return { label: "Weak match", tone: "bad" };
}

/** Sized by CSS (--ring-size), so the same ring is large in the desktop pane and compact in the mobile bar. */
export function ScoreRing({ score, label }: { score: number; label: string }) {
  const size = 96;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" role="img" aria-label={`${label}: ${score} out of 100`} data-tone={verdict(score).tone}>
      <svg viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} />
        <circle className="ring-value" cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <div className="ring-num">{score}</div>
    </div>
  );
}

// ----------------------------------------------------------------- risk
export function RiskView({ report }: { report: RiskReport }) {
  return (
    <ul className="checks">
      {report.checks.map((c) => (
        <li className="check" key={c.id}>
          <span className={`badge ${c.status}`}>{c.status}</span>
          <div>
            <strong>{c.label}.</strong> {c.detail}
            {c.fix && <div className="fix">Fix: {c.fix}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------- tabs (a11y)
export function Tabs<T extends string>({ id, tabs, value, onChange }: { id: string; tabs: { id: T; label: ReactNode }[]; value: T; onChange: (t: T) => void }) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  function onKey(e: KeyboardEvent, index: number) {
    const move = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "Home" ? -index : e.key === "End" ? tabs.length - 1 - index : 0;
    if (!move) return;
    e.preventDefault();
    const next = tabs[(index + move + tabs.length) % tabs.length].id;
    onChange(next);
    refs.current[next]?.focus();
  }
  return (
    <div className="tabs" role="tablist" aria-label="Results sections">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          id={`${id}-tab-${t.id}`}
          role="tab"
          type="button"
          aria-selected={value === t.id}
          aria-controls={`${id}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ id, tab, active, children }: { id: string; tab: string; active: boolean; children: ReactNode }) {
  return (
    <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} hidden={!active} tabIndex={0} className="tabpanel">
      {active && children}
    </div>
  );
}

// -------------------------------------------------------------- feedback
export function Banner({ tone, children, live }: { tone: "good" | "warn" | "bad"; children: ReactNode; live?: boolean }) {
  return (
    <div className={`banner ${tone}`} role={live ? (tone === "bad" ? "alert" : "status") : undefined}>
      <Icon name={tone === "good" ? "check" : "alert"} size={18} />
      <div>{children}</div>
    </div>
  );
}

/** Copies text and says so for a moment. The label swap keeps its width so nothing shifts. */
export function CopyButton({ text, label, className = "btn" }: { text: string; label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed"); // clipboard can be blocked on insecure origins; the caller still shows the text
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button type="button" className={className} onClick={copy}>
      <Icon name={state === "done" ? "check" : "copy"} />
      <span>{state === "done" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
      <span className="sr-only" role="status">{state === "done" ? "Copied to clipboard" : state === "failed" ? "Could not copy" : ""}</span>
    </button>
  );
}

// ------------------------------------------------------- print and files
/** Prints one of the hidden print sheets. The page has two (automatic result, pasted result); only the chosen one prints. */
export function printSheet(kind: "api" | "own") {
  document.body.dataset.print = kind;
  const done = () => {
    delete document.body.dataset.print;
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}
