import { describe, expect, it } from "vitest";
import { ASSISTANTS, MAX_PREFILL_URL, launchUrl } from "@/lib/launch";

const [claude, chatgpt, gemini] = ASSISTANTS;

describe("launchUrl", () => {
  it("puts a short prompt in the address, encoded", () => {
    const prompt = "Tailor this & keep it honest?\nLine two";
    const { href, prefilled } = launchUrl(claude, prompt);
    expect(prefilled).toBe(true);
    expect(new URL(href).searchParams.get("q")).toBe(prompt);
    expect(new URL(launchUrl(chatgpt, prompt).href).searchParams.get("q")).toBe(prompt);
  });

  it("only opens an assistant that has no prefill parameter", () => {
    expect(launchUrl(gemini, "hello")).toEqual({ href: gemini.url, prefilled: false });
  });

  it("never truncates: a long prompt opens the assistant empty", () => {
    const prompt = "word ".repeat(MAX_PREFILL_URL);
    expect(launchUrl(claude, prompt)).toEqual({ href: claude.url, prefilled: false });
  });

  it("falls back when only the encoded form is too long", () => {
    const prompt = "&".repeat(Math.floor(MAX_PREFILL_URL / 2)); // 3 characters each once encoded
    expect(launchUrl(claude, prompt)).toEqual({ href: claude.url, prefilled: false });
  });
});
