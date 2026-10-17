// ABOUTME: Polite Socrata client for data.nola.gov: paged JSON pulls with an optional SoQL window, retries, and
// ABOUTME: the catalog call that tells us which datasets changed since our last pull.

const UA = "seedat-ingest/0.1 (+https://seedat.dunn.us; seedat@dunn.us)";
export const PAGE_SIZE = 10_000;

async function getJson<T>(url: string, attempt = 0): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`socrata ${res.status} after retries: ${url}`);
    await new Promise((r) => setTimeout(r, 2 ** attempt * 2000));
    return getJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`socrata ${res.status}: ${url} ${await res.text()}`);
  return res.json() as Promise<T>;
}

export function pageUrl(datasetId: string, offset: number, where: string | null): string {
  const p = new URLSearchParams({ $limit: String(PAGE_SIZE), $offset: String(offset), $order: ":id" });
  if (where) p.set("$where", where);
  return `https://data.nola.gov/resource/${datasetId}.json?${p}`;
}

export const fetchPage = (datasetId: string, offset: number, where: string | null) =>
  getJson<Record<string, unknown>[]>(pageUrl(datasetId, offset, where));

/** dataset id -> data_updated_at (ISO) for every asset on data.nola.gov, in one catalog call. */
export async function catalogUpdatedAt(): Promise<Map<string, string>> {
  const body = await getJson<{ results: { resource: { id: string; data_updated_at?: string } }[] }>(
    "https://api.us.socrata.com/api/catalog/v1?domains=data.nola.gov&limit=1000");
  return new Map(body.results.map((r) => [r.resource.id, r.resource.data_updated_at ?? ""]));
}
