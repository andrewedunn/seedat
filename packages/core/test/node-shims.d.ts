// ABOUTME: Minimal type declarations for the Node APIs used by tests that read fixture files.
// ABOUTME: Core has no @types/node dependency; this keeps `tsc -p packages/core` clean without adding one.
declare module "node:fs" {
  export function readFileSync(path: string, encoding: "utf8"): string;
}
declare module "node:path" {
  export function join(...parts: string[]): string;
}
interface ImportMeta {
  dirname: string;
}
