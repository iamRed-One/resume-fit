import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { TailorModelOutputSchema, type TailorModelOutput } from "./schemas";
import type { Model, ModelRequest } from "./tailor";

export const MODEL_ID = process.env.ANTHROPIC_MODEL ?? "claude-opus-5-5";

/** Raised when the model declines the request. Surfaced to the user, never retried blindly. */
export class ModelRefusalError extends Error {
  constructor() {
    super("The model declined to process this request.");
  }
}

/** Running token totals for this process, so an evaluation can report what it actually spent. */
export const usage = { calls: 0, inputTokens: 0, outputTokens: 0 };

function track(u: { input_tokens: number; output_tokens: number }) {
  usage.calls += 1;
  usage.inputTokens += u.input_tokens;
  usage.outputTokens += u.output_tokens;
}

let client: Anthropic | undefined;
function getClient(): Anthropic {
  // Credentials resolve from ANTHROPIC_API_KEY or an `ant auth login` profile.
  return (client ??= new Anthropic());
}

async function structured(req: ModelRequest): Promise<TailorModelOutput> {
  const res = await getClient().messages.parse({
    model: MODEL_ID,
    max_tokens: 16000,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    output_config: { effort: req.effort, format: zodOutputFormat(TailorModelOutputSchema) },
  });
  track(res.usage);
  if (res.stop_reason === "refusal") throw new ModelRefusalError();
  if (res.stop_reason === "max_tokens") throw new Error("The tailored resume was cut off. Shorten the resume or posting and retry.");
  if (!res.parsed_output) throw new Error("The model returned a response that did not match the expected shape.");
  return res.parsed_output;
}

async function text(req: ModelRequest): Promise<string> {
  const res = await getClient().messages.create({
    model: MODEL_ID,
    max_tokens: 4000,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
    output_config: { effort: req.effort },
  });
  track(res.usage);
  if (res.stop_reason === "refusal") throw new ModelRefusalError();
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
}

export const claudeModel: Model = { tailor: structured, text };
