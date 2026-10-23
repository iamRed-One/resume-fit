import { NextResponse } from "next/server";
import { fail, readJson } from "@/lib/http";
import { analyzeMatch } from "@/lib/match";
import { runRiskCheck } from "@/lib/risk";
import { AnalyzeRequestSchema } from "@/lib/schemas";

/** Deterministic: no model call, no cost. Match score, missing terms and a risk check on the original resume. */
export async function POST(req: Request) {
  try {
    const { resumeText, jdText } = await readJson(req, AnalyzeRequestSchema);
    const match = analyzeMatch(resumeText, jdText);
    const risk = runRiskCheck({ resumeText, jdText, matchScore: match.score, pages: 1 });
    return NextResponse.json({ match, risk });
  } catch (e) {
    return fail(e);
  }
}
