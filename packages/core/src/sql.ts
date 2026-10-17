// ABOUTME: Writes literal SQL for bulk loads into D1 (wrangler d1 execute --file), with strict value escaping.
// ABOUTME: Used by the backfill; Workers use bound statements instead.

// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function sqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  if (typeof v === "boolean") return v ? "1" : "0";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `'${s.replace(CONTROL, "").replace(/'/g, "''")}'`;
}

export function insertSql(
  table: string, columns: string[], rows: Record<string, unknown>[],
  opts: { chunk?: number; upsertKey?: string[] } = {},
): string[] {
  const chunk = opts.chunk ?? 500;
  const head = `INSERT INTO ${table} (${columns.join(", ")}) VALUES `;
  const tail = opts.upsertKey
    ? ` ON CONFLICT (${opts.upsertKey.join(", ")}) DO UPDATE SET ${columns.filter((c) => !opts.upsertKey!.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ")}`
    : "";
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows.slice(i, i + chunk).map((r) => `(${columns.map((c) => sqlValue(r[c])).join(", ")})`);
    out.push(`${head}${values.join(", ")}${tail};`);
  }
  return out;
}
