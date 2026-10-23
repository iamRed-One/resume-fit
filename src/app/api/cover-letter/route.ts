import { NextResponse } from "next/server";
import { claudeModel } from "@/lib/anthropic";
import { fail, readJson } from "@/lib/http";
import { ResumeSchema, CoverLetterRequestSchema } from "@/lib/schemas";
import { writeCoverLetter } from "@/lib/tailor";

export const maxDuration = 120;

const BodySchema = CoverLetterRequestSchema.omit({ resumeText: true }).extend({ resume: ResumeSchema });

/** Takes the structured (already grounded) resume from /api/tailor, so the letter can only draw on it. */
export async function POST(req: Request) {
  try {
    const { resume, jdText, company, jobTitle } = await readJson(req, BodySchema);
    const letter = await writeCoverLetter({ resume, jdText, company, jobTitle }, claudeModel);
    return NextResponse.json(letter);
  } catch (e) {
    return fail(e);
  }
}
