// ABOUTME: seedat-web router: property pages, address search and typeahead, the parcel map and its data layers,
// ABOUTME: PMTiles from R2 with range requests, and the about/unplaced pages. HTML is edge-cached for 10 minutes.
import { eventPermitSql } from "@seedat/core/src/status";
import { loadProperty } from "@seedat/d1/src/property";
import { resolveAddress, suggest } from "@seedat/d1/src/search";
import { type Env, slug } from "./html";
import { about, home, mapPage, notFound, searchResults, unplaced } from "./pages";
import { renderProperty } from "./property-page";
import { pagesSitemap, parcelSitemap, sitemapIndex } from "./sitemap";

const HTML_TTL = 600;

const json = (v: unknown, maxAge = 300) =>
  new Response(JSON.stringify(v), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${maxAge}` } });

/** Map layers: which parcels to highlight. Each query returns GEOPINs; the response adds each parcel's point. */
const LAYERS: Record<string, string> = {
  permits_90d: "SELECT DISTINCT geopin FROM permit WHERE geopin IS NOT NULL AND applied_date >= date('now', '-90 days')",
  open_cases: "SELECT DISTINCT geopin FROM code_case WHERE geopin IS NOT NULL AND is_open = 1",
  demolition: "SELECT geopin FROM parcel_summary WHERE demolition_permit_date >= date('now', '-5 years')",
  str_active: "SELECT DISTINCT geopin FROM str_license WHERE geopin IS NOT NULL AND is_active = 1",
  hdlc_full: "SELECT geopin FROM parcel WHERE hdlc_control = 'Full'",
};

async function serveTiles(env: Env, req: Request, key: string): Promise<Response> {
  const range = req.headers.get("range");
  const m = range ? /bytes=(\d+)-(\d*)/.exec(range) : null;
  if (m && m[2] && Number(m[2]) < Number(m[1])) return new Response("Range not satisfiable", { status: 416 });
  const obj = await env.ASSETS_BUCKET.get(key, m ? { range: { offset: Number(m[1]), ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) } } : {});
  if (!obj) return new Response("Not found", { status: 404 });
  const headers = new Headers({ "content-type": "application/octet-stream", "accept-ranges": "bytes", "cache-control": "public, max-age=86400", etag: obj.httpEtag });
  if (m && obj.range && "offset" in obj.range) {
    const start = obj.range.offset ?? 0, len = obj.range.length ?? obj.size - start;
    headers.set("content-range", `bytes ${start}-${start + len - 1}/${obj.size}`);
    return new Response(obj.body, { status: 206, headers });
  }
  return new Response(obj.body, { headers });
}

async function route(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname;

  if (path === "/") {
    const s = await env.DB.prepare(`SELECT (SELECT count(*) FROM parcel) parcels, (SELECT count(*) FROM permit) permits,
      (SELECT max(last_success_at) FROM source) updated`).first<{ parcels: number; permits: number; updated: string | null }>();
    return home(env, s ?? { parcels: 0, permits: 0, updated: null });
  }

  if (path === "/search") {
    const q = (url.searchParams.get("q") ?? "").trim().slice(0, 200);
    if (!q) return Response.redirect(`${url.origin}/`, 302);
    const m = await resolveAddress(env.DB, q);
    if (m.geopin) return Response.redirect(`${url.origin}/p/${m.geopin}`, 302);
    return searchResults(env, q, await suggest(env.DB, q), m.reason ?? null);
  }

  if (path === "/api/suggest") {
    return json(await suggest(env.DB, (url.searchParams.get("q") ?? "").slice(0, 100)), 3600);
  }

  const prop = /^\/p\/(\d{8})(?:\/([a-z0-9-]*))?$/.exec(path);
  if (prop) {
    const p = await loadProperty(env.DB, Number(prop[1]));
    if (!p) return notFound(env);
    const street = p.addresses.find((x) => !x.unit_id)?.full_address ?? p.parcel.situs ?? "";
    if (street && prop[2] !== slug(street)) return Response.redirect(`${url.origin}/p/${p.parcel.geopin}/${slug(street)}`, 301);
    return renderProperty(env, p);
  }

  const parcelApi = /^\/api\/parcel\/(\d{8})$/.exec(path);
  if (parcelApi) {
    const r = await env.DB.prepare(`SELECT p.geopin, p.situs, p.lat, p.lon, p.neighborhood, p.zoning, p.local_historic_district, p.hdlc_control,
      s.permits_total, s.permits_open, s.code_cases_open, s.str_active, s.last_permit_date,
      (SELECT full_address FROM address WHERE geopin = p.geopin AND unit_id IS NULL LIMIT 1) address
      FROM parcel p LEFT JOIN parcel_summary s ON s.geopin = p.geopin WHERE p.geopin = ?`).bind(Number(parcelApi[1])).first();
    return r ? json(r) : new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
  }

  if (path === "/api/layer") {
    const sql = LAYERS[url.searchParams.get("name") ?? ""];
    if (!sql) return json({ error: "unknown layer" }, 60);
    const rows = await env.DB.prepare(`SELECT p.geopin, round(p.lat, 6) lat, round(p.lon, 6) lon FROM parcel p WHERE p.geopin IN (${sql})`)
      .all<{ geopin: number; lat: number; lon: number }>();
    return json(rows.results.map((r) => [r.geopin, r.lat, r.lon]), 1800);
  }

  if (path === "/sitemap.xml") return sitemapIndex(env);
  if (path === "/sitemaps/pages.xml") return pagesSitemap();
  const parcelMap = /^\/sitemaps\/parcels-([1-9]\d{0,2})\.xml$/.exec(path);
  if (parcelMap) return (await parcelSitemap(env, Number(parcelMap[1]))) ?? notFound(env);

  if (path === "/tiles/parcels.pmtiles") return serveTiles(env, req, "tiles/parcels.pmtiles");
  if (path === "/map") return mapPage(env);

  if (path === "/about") {
    const [sources, match] = await env.DB.batch([
      env.DB.prepare("SELECT source_id, name, url, license, last_success_at, last_row_count FROM source WHERE source_id LIKE 'socrata:%' OR source_id LIKE 'arcgis:%' ORDER BY name"),
      env.DB.prepare(`SELECT 'permit' entity, match_type, count(*) n FROM permit WHERE NOT ${eventPermitSql()} GROUP BY 2
        UNION ALL SELECT 'code_case', match_type, count(*) FROM code_case GROUP BY 2
        UNION ALL SELECT 'str_license', match_type, count(*) FROM str_license GROUP BY 2`),
    ]);
    return about(env, sources!.results as never, match!.results as never);
  }

  if (path === "/unplaced") {
    const [rows, counts] = await env.DB.batch([
      env.DB.prepare(`SELECT 'permit' entity, permit_num entity_id, address_raw, match_type FROM (SELECT * FROM permit WHERE geopin IS NULL AND NOT ${eventPermitSql()} ORDER BY applied_date DESC LIMIT 100)
        UNION ALL SELECT 'str_license', str_id, address_raw, match_type FROM (SELECT * FROM str_license WHERE geopin IS NULL ORDER BY applied_date DESC LIMIT 50)
        UNION ALL SELECT 'code_case', CAST(case_id AS TEXT), address_raw, match_type FROM (SELECT * FROM code_case WHERE geopin IS NULL ORDER BY filed_date DESC LIMIT 50)`),
      env.DB.prepare(`SELECT 'permit' entity, count(*) n FROM permit WHERE geopin IS NULL AND NOT ${eventPermitSql()} UNION ALL SELECT 'code_case', count(*) FROM code_case WHERE geopin IS NULL
        UNION ALL SELECT 'str_license', count(*) FROM str_license WHERE geopin IS NULL`),
    ]);
    return unplaced(env, rows!.results as never, counts!.results as never);
  }

  return notFound(env);
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    // The MCP server (seedat-api) answers at seedat.dunn.us/mcp through a service binding.
    if (url.pathname === "/mcp") return env.API.fetch(req);
    if (req.method !== "GET" && req.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    const cacheable = req.method === "GET" && !url.pathname.startsWith("/tiles/") && !url.pathname.startsWith("/search");
    const cache = caches.default;
    if (cacheable) {
      const hit = await cache.match(req);
      if (hit) return hit;
    }
    const t0 = Date.now();
    const res = await route(req, env, url);
    const out = new Response(res.body, res);
    out.headers.set("server-timing", `app;dur=${Date.now() - t0}`);
    if (cacheable && res.status === 200) {
      // HTML gets the page TTL; JSON keeps the max-age its route chose.
      if ((res.headers.get("content-type") ?? "").startsWith("text/html")) out.headers.set("cache-control", `public, max-age=${HTML_TTL}`);
      if ((out.headers.get("cache-control") ?? "").includes("public")) ctx.waitUntil(cache.put(req, out.clone()));
    }
    return out;
  },
} satisfies ExportedHandler<Env>;

