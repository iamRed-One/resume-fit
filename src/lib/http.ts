import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { ModelRefusalError } from "./anthropic";

/** Parses and validates a JSON body. Throws ZodError (handled by `fail`) on bad input. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Request body must be JSON." }]);
  }
  return schema.parse(body);
}

/**
 * Maps failures to safe responses. Messages never include request content, and only the
 * error class and status are logged, because the request body is somebody's resume.
 */
export function fail(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    const issues = error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return NextResponse.json({ error: "Invalid request.", issues }, { status: 400 });
  }
  if (error instanceof ModelRefusalError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  if (error instanceof Anthropic.AuthenticationError) {
    console.error("anthropic: authentication failed");
    return NextResponse.json({ error: "The server's Anthropic credentials are missing or invalid." }, { status: 500 });
  }
  if (error instanceof Anthropic.RateLimitError) {
    return NextResponse.json({ error: "The model is busy. Try again in a minute." }, { status: 429 });
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return NextResponse.json({ error: "Could not reach the model. Try again." }, { status: 502 });
  }
  if (error instanceof Anthropic.APIError) {
    console.error(`anthropic: api error status=${error.status}`);
    return NextResponse.json({ error: "The model request failed." }, { status: 502 });
  }
  console.error(`unhandled: ${error instanceof Error ? error.name : "unknown"}`);
  const message = error instanceof Error && /cut off|expected shape/.test(error.message) ? error.message : "Something went wrong.";
  return NextResponse.json({ error: message }, { status: 500 });
}
