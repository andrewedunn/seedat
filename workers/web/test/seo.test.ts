// ABOUTME: Tests the SEO head tags seedat-web puts on every page (canonical, Open Graph, noindex) and the
// ABOUTME: sitemap XML, so canonicals always use the public origin and sitemap URLs are escaped.
import { describe, expect, it } from "vitest";
import { type Env, html, page } from "../src/html";
import { pagesSitemap, urlset } from "../src/sitemap";

const env = { UMAMI_SRC: "", UMAMI_WEBSITE_ID: "" } as Env;

describe("page head", () => {
  it("emits a canonical, og:url and an absolute og:image on the public origin", async () => {
    const doc = await page(env, { title: "Map — See Dat", description: "Browse parcels", path: "/map", body: html`` }).text();
    expect(doc).toContain('<link rel="canonical" href="https://seedat.dunn.us/map">');
    expect(doc).toContain('<meta property="og:url" content="https://seedat.dunn.us/map">');
    expect(doc).toContain('<meta property="og:title" content="Map — See Dat">');
    expect(doc).toContain('<meta property="og:image" content="https://seedat.dunn.us/og.png">');
    expect(doc).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(doc).not.toContain("noindex");
  });

  it("marks pages without a path noindex and gives them no canonical", async () => {
    const doc = await page(env, { title: "Not found — See Dat", description: "Page not found", body: html`` }).text();
    expect(doc).toContain('<meta name="robots" content="noindex">');
    expect(doc).not.toContain('rel="canonical"');
    expect(doc).not.toContain("og:url");
  });
});

describe("sitemaps", () => {
  it("escapes URLs in a urlset", () => {
    expect(urlset(["https://seedat.dunn.us/a?b=1&c=2"])).toContain("<loc>https://seedat.dunn.us/a?b=1&amp;c=2</loc>");
  });

  it("lists the static pages on the public origin", async () => {
    const body = await pagesSitemap().text();
    for (const p of ["/", "/map", "/about", "/unplaced"]) expect(body).toContain(`<loc>https://seedat.dunn.us${p}</loc>`);
    expect(pagesSitemap().headers.get("content-type")).toContain("application/xml");
  });
});
