// ABOUTME: XML sitemaps for seedat-web: an index at /sitemap.xml pointing at the static pages and at every
// ABOUTME: live parcel's address page, split into files of PARCELS_PER_FILE. URLs match each page's canonical.
import { type Env, SITE, esc, slug } from "./html";

export const PARCELS_PER_FILE = 40_000;
const STATIC_PATHS = ["/", "/map", "/about", "/unplaced"];

const xml = (body: string) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}`, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=86400" },
  });

export const urlset = (locs: string[]) =>
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l) => `<url><loc>${esc(l)}</loc></url>`).join("\n")}\n</urlset>`;

export async function sitemapIndex(env: Env): Promise<Response> {
  const r = await env.DB.prepare("SELECT count(*) n FROM parcel WHERE retired_at IS NULL").first<{ n: number }>();
  const files = Math.ceil((r?.n ?? 0) / PARCELS_PER_FILE);
  const locs = [`${SITE}/sitemaps/pages.xml`, ...Array.from({ length: files }, (_, i) => `${SITE}/sitemaps/parcels-${i + 1}.xml`)];
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map((l) => `<sitemap><loc>${l}</loc></sitemap>`).join("\n")}\n</sitemapindex>`);
}

export const pagesSitemap = () => xml(urlset(STATIC_PATHS.map((p) => SITE + p)));

/** One file of address pages. The street is chosen as the property page chooses it, so no URL here redirects. */
export async function parcelSitemap(env: Env, n: number): Promise<Response | null> {
  const rows = await env.DB.prepare(`SELECT p.geopin, coalesce((SELECT full_address FROM address a WHERE a.geopin = p.geopin AND a.unit_id IS NULL
      ORDER BY a.number, a.address_id LIMIT 1), p.situs) street
    FROM parcel p WHERE p.retired_at IS NULL ORDER BY p.geopin LIMIT ? OFFSET ?`)
    .bind(PARCELS_PER_FILE, (n - 1) * PARCELS_PER_FILE).all<{ geopin: number; street: string | null }>();
  if (!rows.results.length) return null;
  return xml(urlset(rows.results.map((r) => `${SITE}/p/${r.geopin}${r.street ? `/${slug(r.street)}` : ""}`)));
}
