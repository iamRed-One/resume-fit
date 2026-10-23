"use client";

import { useRef, useState } from "react";
import { ACCEPT, UploadError, extractFile } from "@/lib/extract";
import { wordCount } from "@/lib/text";
import { Icon } from "./components";

type Notice = { tone: "ok" | "error"; text: string; warnings: string[] } | null;

/**
 * A text editor for one document, with upload in its header and the whole box as a drop target. Files
 * are read in the browser; only the extracted text reaches the editor, where it can be corrected.
 */
export function DocField({ id, label, what, value, onChange, placeholder }: { id: string; label: string; what: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  async function handle(files: FileList | null | undefined) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const r = await extractFile(file.name, await file.arrayBuffer());
      onChange(r.text);
      const size = r.pages ? `${r.pages} page${r.pages > 1 ? "s" : ""}, ` : "";
      const extra = files.length > 1 ? " Only the first file was used." : "";
      setNotice({ tone: "ok", text: `Read ${file.name} (${size}${r.words} words). Check the text before you continue.${extra}`, warnings: r.warnings });
    } catch (e) {
      setNotice({ tone: "error", text: e instanceof UploadError ? e.message : "That file could not be read. Paste the text instead.", warnings: [] });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = ""; // allow choosing the same file again
    }
  }

  const words = wordCount(value);
  return (
    <div
      className={`doc${over ? " over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handle(e.dataTransfer.files);
      }}
    >
      <div className="doc-head">
        <label htmlFor={id}>{label}</label>
        <div className="doc-actions">
          {value && (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => { onChange(""); setNotice(null); }} aria-label={`Clear ${what}`}>
              <Icon name="x" size={16} />
              <span>Clear</span>
            </button>
          )}
          <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
            <Icon name="upload" size={16} />
            <span>{busy ? "Reading..." : "Upload"}</span>
          </button>
        </div>
      </div>
      <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => void handle(e.target.files)} aria-label={`Upload your ${what}`} />
      <div className="doc-box">
        <textarea
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setNotice(null);
          }}
          placeholder={placeholder}
          spellCheck={false}
        />
        {over && <div className="doc-drop" aria-hidden><Icon name="upload" size={22} /> Drop to read this file</div>}
      </div>
      <div className="doc-foot">
        <div role="status" aria-live="polite" className="doc-note">
          {notice && <span className={notice.tone === "error" ? "is-error" : "is-ok"}>{notice.text}</span>}
          {notice?.warnings.map((w) => (
            <span key={w} className="is-warn"> {w}</span>
          ))}
        </div>
        <span className="doc-count">{words > 0 ? `${words.toLocaleString()} words` : ""}</span>
      </div>
    </div>
  );
}
