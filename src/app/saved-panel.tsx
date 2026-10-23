"use client";

import { CopyButton, Icon, download } from "./components";
import type { SavedVersion } from "./types";

export function SavedPanel({ versions, onDelete }: { versions: SavedVersion[]; onDelete: (id: string) => void }) {
  if (versions.length === 0) {
    return (
      <div className="empty-inline">
        <p>No saved versions yet.</p>
        <p className="hint">Use Save version on the Review tab to keep a tailored resume for each job. Versions stay in this browser only.</p>
      </div>
    );
  }
  return (
    <div className="stack">
      <p className="hint">Stored in this browser only. Clearing site data removes them.</p>
      <ul className="saved">
        {versions.map((v) => {
          const name = (v.jobTitle || v.company || "resume").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "resume";
          return (
            <li key={v.id} className="saved-item">
              <div className="saved-title">
                <strong>{v.jobTitle || "Untitled role"}</strong>
                {v.company && <span> at {v.company}</span>}
                <span className="hint"> · score {v.score} · {new Date(v.savedAt).toLocaleDateString()}</span>
              </div>
              <div className="actions">
                <CopyButton text={v.text} label="Copy" className="btn btn-sm" />
                <button type="button" className="btn btn-sm" onClick={() => download(`${name}.txt`, v.text, "text/plain")}>
                  <Icon name="download" size={16} /> <span>.txt</span>
                </button>
                <button type="button" className="btn btn-quiet btn-sm" onClick={() => onDelete(v.id)} aria-label={`Delete saved version for ${v.jobTitle || "untitled role"}`}>
                  <Icon name="x" size={16} /> <span>Delete</span>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
