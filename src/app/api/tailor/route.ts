import { NextResponse } from "next/server";
import { claudeModel } from "@/lib/anthropic";
import { fail, readJson } from "@/lib/http";
import { analyzeMatch } from "@/lib/match";
import { toPlainText } from "@/lib/resume";
import { runRiskCheck } from "@/lib/risk";
import { TailorRequestSchema } from "@/lib/schemas";
import { tailorResume } from "@/lib/tailor";

export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const { resumeText, jdText, prefs } = await readJson(req, TailorRequestSchema);
    const before = analyzeMatch(resumeText, jdText);
    const result = await tailorResume({ resumeText, jdText, prefs }, claudeModel);

    const tailoredText = toPlainText(result.resume);
    const after = analyzeMatch(tailoredText, jdText);
    const risk = runRiskCheck({
      resumeText: tailoredText,
      jdText,
      matchScore: after.score,
      pages: prefs.pages,
      untraceableLines: result.flagged,
    });

    return NextResponse.json({ ...result, before, after, risk });
  } catch (e) {
    return fail(e);
  }
}
