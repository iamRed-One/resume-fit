import { describe, expect, it } from "vitest";
import { checkGrounding } from "@/lib/grounding";
import { JD, RESUME } from "./fixtures";

describe("checkGrounding", () => {
  it("accepts a rewording that keeps every fact", () => {
    const g = checkGrounding(RESUME, "Cut p95 checkout latency 38% by caching with Redis in front of PostgreSQL", JD);
    expect(g.ok).toBe(true);
  });

  it("rejects a number that is not in the resume", () => {
    const g = checkGrounding(RESUME, "Reduced p95 checkout latency by 52% with a Redis cache", JD);
    expect(g.ok).toBe(false);
    expect(g.numbers).toContain("52%");
  });

  it("rejects a tool that is in neither the resume nor the posting", () => {
    const g = checkGrounding(RESUME, "Built the invoicing API with Elasticsearch and Kafka", JD);
    expect(g.ok).toBe(false);
    expect(g.invented).toEqual(expect.arrayContaining(["Elasticsearch", "Kafka"]));
  });

  it("holds back a posting term the resume never shows, instead of silently accepting it", () => {
    const g = checkGrounding(RESUME, "Ran production services on Kubernetes", JD);
    expect(g.ok).toBe(true);
    expect(g.unconfirmed).toContain("Kubernetes");
  });

  it("does not flag the first word of a sentence", () => {
    const g = checkGrounding(RESUME, "Mentored a team of 4 engineers", JD);
    expect(g.ok).toBe(true);
  });

  it("accepts another spelling of a skill the resume already shows", () => {
    const resume = "Operated Kubernetes clusters (k8s) and a Postgres database.";
    expect(checkGrounding(resume, "Ran K8s workloads backed by PostgreSQL", "").ok).toBe(true);
    expect(checkGrounding(resume, "Ran K8s workloads backed by PostgreSQL", "Kubernetes PostgreSQL").unconfirmed).toEqual([]);
  });

  it("still flags a different tool, even in the same family", () => {
    const g = checkGrounding("Operated Kubernetes clusters.", "Operated Kubernetes clusters with Terraform", "Terraform");
    expect(g.unconfirmed).toContain("Terraform");
  });

  it("does not read a digit inside a name as an invented number", () => {
    for (const rewrite of ["Ran K8s workloads", "Stored files in S3 and EC2 volumes", "Built B2B and 3D tools", "Added i18n and 2FA"]) {
      const g = checkGrounding("Operated Kubernetes clusters and AWS storage.", rewrite, "");
      expect(g.numbers, rewrite).toEqual([]);
    }
  });

  it("still catches a changed figure, including percentages, money, multiples and ordinals", () => {
    expect(checkGrounding("Cut cost 40%", "Cut cost 60%", "").numbers).toContain("60%");
    expect(checkGrounding("Raised $2.5M", "Raised $9M", "").numbers).toContain("$9m");
    expect(checkGrounding("Grew traffic 10x", "Grew traffic 20x", "").numbers).toContain("20x");
    expect(checkGrounding("Ranked in the 95th percentile", "Ranked in the 99th percentile", "").numbers).toContain("99th");
    expect(checkGrounding("Led a team of 4", "Led a team of 40", "").numbers).toContain("40");
  });

  it("treats comma formatting of the same number as equal", () => {
    expect(checkGrounding(RESUME, "Served 1200 merchants", JD).ok).toBe(true);
  });
});
