import { wordCount } from "./text";

/**
 * Turns an uploaded file into plain text. Runs in the browser (nothing is uploaded to a server) and
 * in Node, so the same code is tested directly.
 */

export type FileKind = "pdf" | "docx" | "text";

export interface ExtractResult {
  text: string;
  kind: FileKind;
  /** PDF only. */
  pages?: number;
  words: number;
  /** Things worth checking by eye: layout that may have scrambled, very short output. */
  warnings: string[];
}

/** A message safe to show the user as-is. */
export class UploadError extends Error {}

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_PAGES = 12;
const MIN_PDF_WORDS = 20;

export const ACCEPT = ".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown";

const startsWith = (bytes: Uint8Array, ascii: string) => ascii.split("").every((c, i) => bytes[i] === c.charCodeAt(0));

/** Decides the type from the name AND the first bytes, so a renamed file is caught. */
export function detectKind(name: string, head: Uint8Array): FileKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase() ?? "";
  if (ext === "pdf") {
    if (!startsWith(head, "%PDF")) throw new UploadError("That file is named .pdf but is not a PDF.");
    return "pdf";
  }
  if (ext === "docx") {
    if (!startsWith(head, "PK")) throw new UploadError("That file is named .docx but is not a Word document.");
    return "docx";
  }
  if (ext === "doc") throw new UploadError("Old .doc files are not supported. In Word, choose Save As and pick .docx or PDF, then upload that.");
  if (["rtf", "odt", "pages"].includes(ext)) throw new UploadError(`.${ext} files are not supported. Save it as PDF or .docx and upload that.`);
  if (["txt", "text", "md", "markdown"].includes(ext)) {
    if (head.slice(0, 1024).includes(0)) throw new UploadError("That does not look like a text file.");
    return "text";
  }
  throw new UploadError("Upload a PDF, a Word (.docx) file, or a .txt / .md file.");
}

// ---------------------------------------------------------------- normalising

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl" };
// Bullet glyphs as they appear in extracted text, including Word's private-use symbol-font bullets.
const BULLET_START = /^[•●▪▫◦‣∙○■□➢➤✓✔►▸·–—*]\s*/;
const BULLET_ONLY = /^[•●▪▫◦‣∙○■□➢➤✓✔►▸·]$/;
const PAGE_NUMBER = /^(page\s*)?\d{1,3}(\s*(of|\/)\s*\d{1,3})?$/i;
const FUNCTION_END = /\b(a|an|and|at|by|for|from|in|of|on|or|the|to|with|using|across|into)$/i;
const HEADING = /^[A-Z][A-Z &/,'-]{2,40}$/;

function shouldJoin(prev: string, line: string): boolean {
  if (line.startsWith("- ") || prev.startsWith("#")) return false;
  if (HEADING.test(prev)) return false;
  // Contact details and names often start lowercase on their own line.
  if (/^\S+@\S+|^https?:|^www\.|^\+?\d[\d\s().-]{6,}$/.test(line)) return false;
  if (prev.length >= 30 && /^[a-z(]/.test(line) && !/[.!?]$/.test(prev)) return true;
  if (prev.length >= 40 && /[,;]$|(^|\s)\S*$/.test(prev) && (/[,;]$/.test(prev) || FUNCTION_END.test(prev))) return true;
  return false;
}

/**
 * Cleans text from a PDF or Word file: ligatures, odd spaces, bullet glyphs to "- ", lines that were
 * wrapped mid-sentence rejoined, page numbers dropped, blank lines collapsed. It never adds words.
 */
export function normalizeExtractedText(raw: string): string {
  const cleaned = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ﬀ-ﬄ]/g, (c) => LIGATURES[c])
    .replace(/[     \t]/g, " ")
    .replace(/[​-‍﻿­]/g, "");

  // 1. Bullet glyphs become "- "; a glyph alone on a line is attached to the next line.
  const lines: string[] = [];
  const input = cleaned.split("\n").map((l) => l.replace(/ +/g, " ").trim());
  for (let i = 0; i < input.length; i++) {
    let line = input[i];
    if (BULLET_ONLY.test(line)) {
      const next = input[i + 1];
      if (next) {
        lines.push(`- ${next}`);
        i++;
      }
      continue;
    }
    if (BULLET_START.test(line) && line.replace(BULLET_START, "").length > 0 && !/^[–—]\s*\d/.test(line)) {
      line = `- ${line.replace(BULLET_START, "")}`;
    }
    lines.push(line);
  }

  // 2. Rejoin sentences that the page layout wrapped, then drop page numbers.
  const joined: string[] = [];
  for (const line of lines) {
    const prev = joined[joined.length - 1];
    if (line && prev && shouldJoin(prev, line)) joined[joined.length - 1] = `${prev} ${line}`;
    else joined.push(line);
  }

  return joined
    .filter((l) => !PAGE_NUMBER.test(l))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Word documents come back as HTML so list items keep their bullets. */
export function htmlToText(html: string): string {
  return html
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|h[1-6]|li|ul|ol|div|tr|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    // Each block above ends a line; adjacent ends must not become blank lines between bullets.
    .replace(/\n\s*\n/g, "\n");
}

function warningsFor(text: string): string[] {
  const out: string[] = [];
  const words = wordCount(text);
  if (words < 80) out.push(`Only ${words} words came through. Check that the whole document was read.`);
  const lines = text.split("\n").filter(Boolean);
  if (lines.length > 40) {
    const lengths = lines.map((l) => l.length).sort((a, b) => a - b);
    if (lengths[Math.floor(lengths.length / 2)] < 18) {
      out.push("The text came out in very short pieces, which usually means a multi-column layout. Check the order below, or paste the text instead.");
    }
  }
  return out;
}

// ----------------------------------------------------------------- extracting

async function fromPdf(bytes: ArrayBuffer): Promise<{ text: string; pages: number }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  try {
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    if (pdf.numPages > MAX_PDF_PAGES) {
      throw new UploadError(`That PDF has ${pdf.numPages} pages. Resumes and postings are rarely over ${MAX_PDF_PAGES}; paste the text instead.`);
    }
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    return { text, pages: totalPages };
  } catch (e) {
    if (e instanceof UploadError) throw e;
    const name = e instanceof Error ? e.name : "";
    if (name === "PasswordException") throw new UploadError("That PDF is password-protected. Remove the password and try again.");
    throw new UploadError("That PDF could not be read. Try exporting it again, or paste the text.");
  }
}

async function fromDocx(bytes: ArrayBuffer): Promise<string> {
  const mod = await import("mammoth");
  const mammoth = mod.default ?? mod;
  // Node wants a Buffer; mammoth's browser build wants an ArrayBuffer. Decide by environment, not by whether
  // a bundler happened to shim Buffer.
  const input = typeof window === "undefined" ? { buffer: Buffer.from(bytes) } : { arrayBuffer: bytes };
  try {
    return htmlToText((await mammoth.convertToHtml(input as Parameters<typeof mammoth.convertToHtml>[0])).value);
  } catch (e) {
    console.warn("docx read failed:", e instanceof Error ? e.message.slice(0, 200) : "unknown error"); // never the file contents
    throw new UploadError("That Word file could not be read. Is it a .docx saved from Word, Google Docs or Pages?");
  }
}

export async function extractFile(name: string, bytes: ArrayBuffer): Promise<ExtractResult> {
  if (bytes.byteLength === 0) throw new UploadError("That file is empty.");
  if (bytes.byteLength > MAX_FILE_BYTES) throw new UploadError(`That file is ${(bytes.byteLength / 1048576).toFixed(1)} MB. The limit is ${MAX_FILE_BYTES / 1048576} MB.`);
  const kind = detectKind(name, new Uint8Array(bytes.slice(0, 1024)));

  let raw: string;
  let pages: number | undefined;
  if (kind === "pdf") ({ text: raw, pages } = await fromPdf(bytes));
  else if (kind === "docx") raw = await fromDocx(bytes);
  else raw = new TextDecoder("utf-8").decode(bytes);

  const text = normalizeExtractedText(raw);
  const words = wordCount(text);
  if (kind === "pdf" && words < MIN_PDF_WORDS) {
    throw new UploadError("No selectable text found. This looks like a scanned or image-only PDF. Paste the text, or export a text-based PDF from Word or Google Docs.");
  }
  if (words === 0) throw new UploadError("No text was found in that file.");
  return { text, kind, pages, words, warnings: warningsFor(text) };
}
