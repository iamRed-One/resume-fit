import { readFileSync } from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, UploadError, detectKind, extractFile, htmlToText, normalizeExtractedText } from "@/lib/extract";
import { analyzeMatch } from "@/lib/match";
import { JD } from "./fixtures";

const file = (name: string) => readFileSync(path.join(import.meta.dirname, "files", name));
const ab = (b: Uint8Array | Buffer): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const u8 = (s: string) => new TextEncoder().encode(s);
const bytes = (s: string) => ab(u8(s));

describe("normalizeExtractedText", () => {
  it("turns bullet glyphs, including Word's symbol-font bullets, into dashes", () => {
    const out = normalizeExtractedText("• Built the API\n Led a team\n▪ Wrote tests");
    expect(out).toBe("- Built the API\n- Led a team\n- Wrote tests");
  });

  it("attaches a bullet glyph that sits alone on its own line", () => {
    expect(normalizeExtractedText("•\nBuilt the API")).toBe("- Built the API");
  });

  it("repairs ligatures and odd spaces", () => {
    expect(normalizeExtractedText("oﬃce work​\nﬁnance")).toBe("office work\nfinance");
  });

  it("rejoins a sentence the page layout wrapped", () => {
    const out = normalizeExtractedText("- Led a team of 4 engineers building the invoicing API used by merchants,\nincluding the billing ledger\n- Wrote tests");
    expect(out).toBe("- Led a team of 4 engineers building the invoicing API used by merchants, including the billing ledger\n- Wrote tests");
  });

  it("rejoins when a line ends on a function word", () => {
    expect(normalizeExtractedText("Reduced p95 checkout latency by 38% with a Redis cache in front of\nPostgreSQL")).toBe(
      "Reduced p95 checkout latency by 38% with a Redis cache in front of PostgreSQL",
    );
  });

  it("does not glue a name to the contact line, or a heading to its content", () => {
    expect(normalizeExtractedText("Jordan Rivera\njordan.rivera@example.com")).toBe("Jordan Rivera\njordan.rivera@example.com");
    expect(normalizeExtractedText("SKILLS\ntypescript and node")).toBe("SKILLS\ntypescript and node");
  });

  it("drops page numbers and collapses blank lines", () => {
    expect(normalizeExtractedText("one\n\n\n\n2\n\nPage 2 of 3\ntwo")).toBe("one\n\ntwo");
  });

  it("keeps a date range that begins with a dash from becoming a bullet", () => {
    expect(normalizeExtractedText("– 2021 Present")).toBe("– 2021 Present");
  });

  it("never adds words", () => {
    const raw = "Senior Engineer, Northwind\n• Cut latency 38% using Redis,\nand Postgres";
    const words = (s: string) => s.replace(/[-•]/g, "").split(/\s+/).filter(Boolean);
    expect(words(normalizeExtractedText(raw))).toEqual(words(raw));
  });
});

describe("htmlToText", () => {
  it("keeps list items as dashes and decodes entities", () => {
    expect(htmlToText("<h1>Jordan</h1><p>Skills &amp; tools</p><ul><li>Go</li><li>Rust &lt;3</li></ul>").replace(/\n+/g, "\n").trim()).toBe(
      "Jordan\nSkills & tools\n- Go\n- Rust <3",
    );
  });
});

describe("detectKind", () => {
  it("accepts the supported types", () => {
    expect(detectKind("a.pdf", u8("%PDF-1.7"))).toBe("pdf");
    expect(detectKind("a.docx", u8("PK\u0003\u0004"))).toBe("docx");
    expect(detectKind("a.TXT", u8("hello"))).toBe("text");
    expect(detectKind("a.md", u8("# hello"))).toBe("text");
  });

  it("catches a renamed file by its first bytes", () => {
    expect(() => detectKind("resume.pdf", u8("PK\u0003\u0004"))).toThrow(/not a PDF/);
    expect(() => detectKind("resume.docx", u8("%PDF-1.7"))).toThrow(/not a Word/);
    expect(() => detectKind("resume.txt", new Uint8Array([0x4d, 0x5a, 0, 0, 0]))).toThrow(/text file/);
  });

  it("explains what to do for formats it cannot read", () => {
    expect(() => detectKind("a.doc", u8("x"))).toThrow(/Save As/);
    expect(() => detectKind("a.pages", u8("x"))).toThrow(/PDF or .docx/);
    expect(() => detectKind("a.png", u8("x"))).toThrow(/Upload a PDF/);
    expect(() => detectKind("noextension", u8("x"))).toThrow(UploadError);
  });
});

describe("extractFile: a real PDF made by Chrome", () => {
  it("reads the text, rejoins wrapped bullets and keeps the structure", async () => {
    const r = await extractFile("resume-sample.pdf", ab(file("resume-sample.pdf")));
    expect(r.kind).toBe("pdf");
    expect(r.pages).toBe(1);
    expect(r.text).toContain("Jordan Rivera\njordan.rivera@example.com");
    expect(r.text).toContain("from first prototype through to services handling millions of requests a day.");
    expect(r.text).toContain("by adding a Redis cache in front of PostgreSQL");
    expect(r.text).toContain("SKILLS\nTypeScript, Node.js");
    expect(r.text).toContain("2021 – Present");
    expect(r.warnings).toEqual([]);
  });

  it("produces text the scorer can use", async () => {
    const r = await extractFile("resume-sample.pdf", ab(file("resume-sample.pdf")));
    const m = analyzeMatch(r.text, JD);
    expect(m.matched.map((t) => t.toLowerCase())).toEqual(expect.arrayContaining(["node.js", "typescript", "postgresql", "kubernetes", "aws"]));
  });
});

describe("extractFile: PDFs that cannot be read", () => {
  it("says so for a PDF with no selectable text (a scan or image)", async () => {
    await expect(extractFile("scan.pdf", ab(file("no-text.pdf")))).rejects.toThrow(/No selectable text found.*scanned/);
  });

  it("rejects garbage that only claims to be a PDF", async () => {
    await expect(extractFile("bad.pdf", bytes("%PDF-1.4 this is not really a pdf"))).rejects.toThrow(UploadError);
  });
});

async function makeDocx(): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>`,
  );
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/></Relationships>`);
  zip.file("word/numbering.xml", `<?xml version="1.0" encoding="UTF-8"?><w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="&#8226;"/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`);
  const p = (t: string) => `<w:p><w:r><w:t>${t}</w:t></w:r></w:p>`;
  const li = (t: string) => `<w:p><w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t>${t}</w:t></w:r></w:p>`;
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${p("Jordan Rivera")}${p("Experience")}${li("Led a team of 4 engineers &amp; shipped the API")}${li("Cut latency by 38%")}${p("Education")}${p("B.Sc. Computer Science, 2018")}</w:body></w:document>`,
  );
  return ab(await zip.generateAsync({ type: "uint8array" }));
}

describe("extractFile: Word", () => {
  it("reads paragraphs and keeps list items as bullets", async () => {
    const r = await extractFile("resume.docx", await makeDocx());
    expect(r.kind).toBe("docx");
    expect(r.text).toContain("Jordan Rivera\nExperience");
    expect(r.text).toContain("- Led a team of 4 engineers & shipped the API\n- Cut latency by 38%");
    expect(r.text).toContain("B.Sc. Computer Science, 2018");
  });

  it("rejects a corrupt .docx with a clear message", async () => {
    await expect(extractFile("bad.docx", bytes("PK\u0003\u0004 not a zip"))).rejects.toThrow(/could not be read/);
  });
});

describe("extractFile: text, size and emptiness", () => {
  it("reads text and strips a byte-order mark", async () => {
    const r = await extractFile("r.txt", bytes("﻿Jordan Rivera\n- Built things with Go and Redis for payments"));
    expect(r.text.startsWith("Jordan")).toBe(true);
    expect(r.kind).toBe("text");
  });

  it("flags very short output without failing", async () => {
    const r = await extractFile("r.txt", bytes("Jordan Rivera\n- Built things"));
    expect(r.warnings[0]).toMatch(/Only \d+ words/);
  });

  it("refuses an empty file, an oversize file, and a file with no text", async () => {
    await expect(extractFile("r.txt", new ArrayBuffer(0))).rejects.toThrow(/empty/);
    await expect(extractFile("r.txt", new ArrayBuffer(MAX_FILE_BYTES + 1))).rejects.toThrow(/limit is 5 MB/);
    await expect(extractFile("r.txt", bytes("   \n\n  "))).rejects.toThrow(/No text/);
  });
});
