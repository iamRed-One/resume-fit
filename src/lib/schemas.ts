import { z } from "zod";

export const MAX_RESUME_CHARS = 30_000;
export const MAX_JD_CHARS = 20_000;

export const ResumeSchema = z.object({
  name: z.string(),
  contact: z.array(z.string()),
  summary: z.string(),
  skills: z.array(z.string()),
  experience: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      dates: z.string(),
      bullets: z.array(z.string()),
    }),
  ),
  education: z.array(z.string()),
  additional: z.array(z.object({ heading: z.string(), lines: z.array(z.string()) })),
});
export type Resume = z.infer<typeof ResumeSchema>;

export const ChangeSectionSchema = z.enum(["summary", "skills", "experience", "education", "additional"]);

export const ModelChangeSchema = z.object({
  section: ChangeSectionSchema,
  before: z.string(),
  after: z.string(),
  /** The posting requirement this edit answers, in the posting's words. */
  requirement: z.string(),
  /** Why the edit helps, in one plain sentence. */
  reason: z.string(),
});

export const TailorModelOutputSchema = z.object({
  resume: ResumeSchema,
  changeLog: z.array(ModelChangeSchema),
  /** Posting skills the resume does not show. The user decides whether they are true. */
  suggestedSkills: z.array(z.string()),
});
export type TailorModelOutput = z.infer<typeof TailorModelOutputSchema>;

export type ChangeStatus = "applied" | "reverted" | "needs-review";

export interface ChangeEntry extends z.infer<typeof ModelChangeSchema> {
  status: ChangeStatus;
  /** Why a change was reverted or flagged. Absent for clean edits. */
  note?: string;
}

export const PrefsSchema = z.object({
  pages: z.union([z.literal(1), z.literal(2)]).default(1),
  tone: z.enum(["standard professional", "confident", "warm", "concise"]).default("standard professional"),
  intensity: z.enum(["light", "balanced", "complete"]).default("balanced"),
});
export type Prefs = z.infer<typeof PrefsSchema>;

export const AnalyzeRequestSchema = z.object({
  resumeText: z.string().min(50).max(MAX_RESUME_CHARS),
  jdText: z.string().min(50).max(MAX_JD_CHARS),
});

export const TailorRequestSchema = AnalyzeRequestSchema.extend({
  prefs: PrefsSchema.default({ pages: 1, tone: "standard professional", intensity: "balanced" }),
});

export const CoverLetterRequestSchema = z.object({
  resumeText: z.string().min(50).max(MAX_RESUME_CHARS),
  jdText: z.string().min(50).max(MAX_JD_CHARS),
  company: z.string().max(120).optional(),
  jobTitle: z.string().max(120).optional(),
});
