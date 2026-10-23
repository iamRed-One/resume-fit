import type { GroundingReport } from "@/lib/grounding";
import type { ChangeEntry, Resume } from "@/lib/schemas";

/** The response of POST /api/tailor. */
export interface TailorResponse {
  resume: Resume;
  changeLog: ChangeEntry[];
  suggestedSkills: string[];
  warnings: { text: string; problems: string[] }[];
  flagged: number;
}

export interface Letter {
  text: string;
  grounding: GroundingReport;
}

/** A saved resume, kept as plain text so both ways of tailoring can save. */
export interface SavedVersion {
  id: string;
  savedAt: string;
  jobTitle: string;
  company: string;
  score: number;
  text: string;
}
