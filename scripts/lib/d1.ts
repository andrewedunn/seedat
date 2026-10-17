// ABOUTME: Writes SQL statement files and loads them into the remote seedat-db with wrangler.
// ABOUTME: Files are split so each stays well under D1's per-import limits.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA } from "./raw";

const SQL_DIR = join(DATA, "sql");
const MAX_BYTES = 80 * 1024 * 1024;

/** Write statements to data/sql/<name>-NNN.sql, splitting at MAX_BYTES. Returns the file paths. */
export function writeSqlFiles(name: string, statements: string[]): string[] {
  mkdirSync(SQL_DIR, { recursive: true });
  const files: string[] = [];
  let buf: string[] = [], size = 0;
  const flush = () => {
    if (!buf.length) return;
    const path = join(SQL_DIR, `${name}-${String(files.length).padStart(3, "0")}.sql`);
    writeFileSync(path, buf.join("\n") + "\n");
    files.push(path);
    buf = []; size = 0;
  };
  for (const s of statements) {
    if (size + s.length > MAX_BYTES) flush();
    buf.push(s); size += s.length + 1;
  }
  flush();
  return files;
}

export function loadSqlFiles(files: string[], log = console.log) {
  for (const f of files) {
    log(`loading ${f}`);
    execFileSync("npx", ["wrangler", "d1", "execute", "seedat-db", "--remote", "--file", f, "-y"],
      { cwd: join(DATA, "..", "workers", "ingest"), stdio: ["ignore", "ignore", "inherit"] });
  }
}
