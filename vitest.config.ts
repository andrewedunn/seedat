// ABOUTME: Vitest config for the whole repo; tests live next to each package under test/.
// ABOUTME: Runs in Node; Worker-specific tests use their own config when added.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["packages/*/test/**/*.test.ts", "workers/*/test/**/*.test.ts"] } });
