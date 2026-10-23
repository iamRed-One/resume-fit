"use client";

import { useEffect, useState } from "react";

export const THEMES = [
  { id: "ocean", name: "Ocean", swatch: "linear-gradient(135deg, #2563eb 50%, #dbeafe 50%)" },
  { id: "emerald", name: "Emerald", swatch: "linear-gradient(135deg, #047857 50%, #d1fae5 50%)" },
  { id: "graphite", name: "Graphite", swatch: "linear-gradient(135deg, #18181b 50%, #e4e4e7 50%)" },
  { id: "midnight", name: "Midnight (dark)", swatch: "linear-gradient(135deg, #0b1220 50%, #7aa7ff 50%)" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];
export const THEME_KEY = "resumefit:theme";

/**
 * Runs in <head> before first paint, so there is no flash of the wrong colours. A saved choice wins;
 * otherwise a dark operating system gets Midnight and everyone else gets Ocean.
 */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(!/^(ocean|emerald|graphite|midnight)$/.test(t||"")){t=matchMedia("(prefers-color-scheme: dark)").matches?"midnight":"ocean"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="ocean"}})();`;

export function ThemePicker() {
  const [theme, setTheme] = useState<ThemeId | null>(null);
  useEffect(() => setTheme((document.documentElement.dataset.theme as ThemeId) || "ocean"), []);

  function choose(id: ThemeId) {
    document.documentElement.dataset.theme = id;
    setTheme(id);
    try {
      localStorage.setItem(THEME_KEY, id);
    } catch {
      /* storage can be blocked; the choice then lasts until the page closes */
    }
  }

  return (
    <div className="themes" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button key={t.id} type="button" className="swatch" aria-pressed={theme === t.id} aria-label={`${t.name} theme`} title={`${t.name} theme`} onClick={() => choose(t.id)} style={{ "--sw": t.swatch } as React.CSSProperties}>
          <span />
        </button>
      ))}
    </div>
  );
}
