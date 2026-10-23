import { defineConfig } from "vitest/config";
import path from "node:path";

// Evaluations are separate from unit tests: they print metrics and need local data in evals/data.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: { include: ["evals/**/*.eval.ts"] },
});
