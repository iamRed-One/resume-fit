import { describe, expect, it } from "vitest";
import { runRiskCheck } from "@/lib/risk";
import { JD, RESUME } from "./fixtures";

const base = { resumeText: RESUME, jdText: JD, matchScore: 80, pages: 1 as const };
const byId = (r: ReturnType<typeof runRiskCheck>, id: string) => r.checks.find((c) => c.id === id)!;

describe("runRiskCheck", () => {
  it("passes a clean single-column resume with strong coverage", () => {
    const r = runRiskCheck(base);
    expect(byId(r, "keywords").status).toBe("pass");
    expect(byId(r, "format").status).toBe("pass");
    expect(byId(r, "leadership").status).toBe("pass");
  });

  it("fails keyword coverage under 45", () => {
    expect(byId(runRiskCheck({ ...base, matchScore: 30 }), "keywords").status).toBe("fail");
  });

  it("warns when most bullets state no result", () => {
    const text = RESUME.replace(/\d/g, "x");
    expect(byId(runRiskCheck({ ...base, resumeText: text }), "impact").status).not.toBe("pass");
  });

  it("flags a table-like layout and a missing email", () => {
    const table = "Jordan   Rivera\n\nExperience | Skills | Dates\nEngineer    Node    2020";
    const c = byId(runRiskCheck({ ...base, resumeText: table }), "format");
    expect(c.status).toBe("fail");
    expect(c.fix).toBeTruthy();
  });

  it("asks for leadership evidence only when the posting does", () => {
    const noLead = "Experience\n- Wrote code\n- Fixed bugs and shipped features for 3 products";
    expect(byId(runRiskCheck({ ...base, resumeText: noLead }), "leadership").status).toBe("warn");
    expect(byId(runRiskCheck({ ...base, resumeText: noLead, jdText: "Write Go services." }), "leadership").status).toBe("pass");
  });

  it("flags an over-length resume", () => {
    const long = RESUME + "\n- " + "word ".repeat(700);
    expect(byId(runRiskCheck({ ...base, resumeText: long }), "length").status).not.toBe("pass");
  });

  it("reports untraceable lines and rolls up the worst status", () => {
    const r = runRiskCheck({ ...base, matchScore: 20, untraceableLines: 2 });
    expect(byId(r, "trace").status).toBe("warn");
    expect(r.overall).toBe("fail");
  });
});
