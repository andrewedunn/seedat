// ABOUTME: Merges rows from several sources that feed one table, column by column, by source priority.
// ABOUTME: Lower priority numbers win; later sources only fill columns that are still null, except a source's `wins` columns.

/** `wins`: columns this source supplies ahead of higher-priority sources, whenever it has a value for them. */
export interface SourcedRow { sourceId: string; priority: number; row: Record<string, unknown>; wins?: readonly string[] }

export function mergeRows(parts: SourcedRow[]): { row: Record<string, unknown>; sources: string[] } {
  const ordered = [...parts].sort((a, b) => a.priority - b.priority);
  const row: Record<string, unknown> = {};
  for (const { row: r, wins } of ordered) {
    for (const k of wins ?? []) if (r[k] !== null && r[k] !== undefined && (row[k] === null || row[k] === undefined)) row[k] = r[k];
  }
  for (const { row: r } of ordered) {
    for (const [k, v] of Object.entries(r)) {
      if (v !== null && v !== undefined && (row[k] === null || row[k] === undefined)) row[k] = v;
      else if (!(k in row)) row[k] = v ?? null;
    }
  }
  for (const k of Object.keys(row)) if (row[k] === undefined) row[k] = null;
  return { row, sources: ordered.map((p) => p.sourceId) };
}
