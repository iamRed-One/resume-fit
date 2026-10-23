/** Where the "Open <assistant>" links go, and whether the prompt can ride along in the address. */

export interface Assistant {
  name: string;
  url: string;
  /** Query parameter that pre-fills the chat box. Absent when the site has no such parameter. */
  param?: string;
}

// Claude and ChatGPT fill the box from ?q=. Gemini's site has no equivalent, so it only opens.
export const ASSISTANTS: Assistant[] = [
  { name: "Claude", url: "https://claude.ai/new", param: "q" },
  { name: "ChatGPT", url: "https://chatgpt.com/", param: "q" },
  { name: "Gemini", url: "https://gemini.google.com/app" },
];

/**
 * A prompt carries a whole resume and posting, which is usually far more than an address can hold. Past
 * this many characters the link opens the assistant empty and the copy on the clipboard does the work.
 * Cut-off text would be worse than none, so a long prompt is never truncated into the link. The limit is
 * a cautious guess at what web servers accept, not a number the providers publish.
 */
export const MAX_PREFILL_URL = 6000;

export function launchUrl(a: Assistant, prompt: string): { href: string; prefilled: boolean } {
  if (!a.param || prompt.length > MAX_PREFILL_URL) return { href: a.url, prefilled: false }; // encoding never shrinks text
  const href = `${a.url}?${a.param}=${encodeURIComponent(prompt)}`;
  return href.length <= MAX_PREFILL_URL ? { href, prefilled: true } : { href: a.url, prefilled: false };
}
