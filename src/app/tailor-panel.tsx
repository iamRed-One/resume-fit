"use client";

import { useState } from "react";
import { ASSISTANTS, launchUrl } from "@/lib/launch";
import { Banner, CopyButton, Icon } from "./components";

/** Two steps, in order: copy the prompt, paste the reply. The automatic route is tucked away: it needs a key. */
export function TailorPanel({
  prompt,
  reply,
  onReply,
  onAuto,
  autoBusy,
  autoError,
}: {
  prompt: string;
  reply: string;
  onReply: (v: string) => void;
  onAuto: () => void;
  autoBusy: boolean;
  autoError: string | null;
}) {
  const [opened, setOpened] = useState<{ name: string; prefilled: boolean; copied: boolean } | null>(null);

  // The prompt is always copied too, so a site that ignores the pre-fill, or a prompt too long for the link, still works.
  async function open(name: string, prefilled: boolean) {
    let copied = true;
    try {
      await navigator.clipboard.writeText(prompt);
    } catch {
      copied = false; // blocked on insecure origins; the Preview below still has the text
    }
    setOpened({ name, prefilled, copied });
  }

  return (
    <div className="stack">
      <p className="hint">Use the chat AI you already pay for. You keep control of what is sent to it, and we check what comes back against your original resume.</p>

      <section className="step">
        <h3><span className="step-n" aria-hidden>1</span> Copy the prompt</h3>
        <p className="hint">It carries your resume, the posting, and what is missing, plus rules against inventing anything.</p>
        <div className="actions">
          <CopyButton text={prompt} label="Copy prompt" className="btn btn-primary" />
          <span className="open-in">
            Open
            {ASSISTANTS.map((a) => {
              const { href, prefilled } = launchUrl(a, prompt);
              return (
                <a key={a.name} href={href} target="_blank" rel="noopener noreferrer" onClick={() => void open(a.name, prefilled)}>
                  {a.name}
                  <Icon name="external" size={14} />
                </a>
              );
            })}
          </span>
        </div>
        <p className="hint" role="status">
          {opened &&
            (opened.prefilled
              ? `Opened ${opened.name} with the prompt filled in.${opened.copied ? " It is on your clipboard too, in case the box is empty." : ""}`
              : opened.copied
                ? `Prompt copied. In ${opened.name}, click the message box and paste it (Ctrl+V, or Cmd+V on a Mac).`
                : `Opened ${opened.name}. Copying was blocked here: use Copy prompt, or open Preview below and select the text.`)}
        </p>
        <details className="disclose">
          <summary>Preview the prompt</summary>
          <textarea readOnly value={prompt} aria-label="Prompt text" className="preview" onFocus={(e) => e.currentTarget.select()} />
        </details>
      </section>

      <section className="step">
        <h3><span className="step-n" aria-hidden>2</span> <label htmlFor="reply">Paste the reply</label></h3>
        <p className="hint">Paste the whole answer, including the line that says RESUME. The check runs as soon as you paste.</p>
        <textarea id="reply" className="reply" value={reply} onChange={(e) => onReply(e.target.value)} placeholder="=== RESUME ===" spellCheck={false} />
      </section>

      <details className="disclose auto">
        <summary>Or let our server do it (needs an API key)</summary>
        <p className="hint">This sends your resume and the posting to the model through this app&apos;s server. It reverts edits that invent facts and keeps a change log, and it can write a cover letter.</p>
        <button type="button" className="btn" onClick={onAuto} disabled={autoBusy}>
          {autoBusy ? "Tailoring... this can take a minute" : "Tailor automatically"}
        </button>
        {autoError && <Banner tone="bad" live>{autoError}</Banner>}
      </details>
    </div>
  );
}
