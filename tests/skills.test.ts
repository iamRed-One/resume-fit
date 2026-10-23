import { describe, expect, it } from "vitest";
import { SKILLS } from "@/lib/skills";
import { extractRequirements } from "@/lib/keywords";

describe("skills dictionary", () => {
  it("lists each skill once, so no requirement can appear twice", () => {
    const names = SKILLS.map((s) => s.display.toLowerCase());
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("returns one requirement for a skill the dictionary lists in two fields", () => {
    const terms = extractRequirements("Requirements\n- Build and own data pipelines and ETL jobs\n- Data engineering experience").map((r) => r.term);
    expect(terms.filter((t) => t === "Data Pipelines")).toHaveLength(1);
  });
});
