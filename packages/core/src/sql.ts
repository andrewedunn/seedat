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
  opts: { chunk?: number; upsertKey?: string[]; maxBytes?: number } = {},
): string[] {
  const chunk = opts.chunk ?? 500;
  const maxBytes = opts.maxBytes ?? 90_000; // D1 rejects statements over 100 KB
  const head = `INSERT INTO ${table} (${columns.join(", ")}) VALUES `;
  const tail = opts.upsertKey
    ? ` ON CONFLICT (${opts.upsertKey.join(", ")}) DO UPDATE SET ${columns.filter((c) => !opts.upsertKey!.includes(c)).map((c) => `${c} = excluded.${c}`).join(", ")}`
    : "";
  const out: string[] = [];
  let values: string[] = [], size = head.length + tail.length + 1;
  const flush = () => { if (values.length) out.push(`${head}${values.join(", ")}${tail};`); values = []; size = head.length + tail.length + 1; };
  for (const r of rows) {
    const v = `(${columns.map((c) => sqlValue(r[c])).join(", ")})`;
    if (values.length && (values.length >= chunk || size + v.length + 2 > maxBytes)) flush();
    values.push(v);
    size += v.length + 2;
  }
  flush();
  return out;
}
