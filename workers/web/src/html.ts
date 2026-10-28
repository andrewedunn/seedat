// ABOUTME: HTML helpers for seedat-web: escaping, the page shell (fonts, styles, analytics), the tiled address,
// ABOUTME: and small formatters for dates, money and status shared by every page.

export interface Env { DB: D1Database; ASSETS: Fetcher; ASSETS_BUCKET: R2Bucket; API: Fetcher; UMAMI_SRC: string; UMAMI_WEBSITE_ID: string }

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (v: unknown): string => (v === null || v === undefined ? "" : String(v).replace(/[&<>"']/g, (c) => ESC[c]!));

/** Tagged template that escapes interpolations unless they are already-rendered `Html`. */
export class Html { constructor(readonly s: string) {} toString() { return this.s; } }
export const raw = (s: string) => new Html(s);
export function html(strings: TemplateStringsArray, ...vals: unknown[]): Html {
  let out = strings[0]!;
  vals.forEach((v, i) => {
    const part = Array.isArray(v) ? v.map((x) => (x instanceof Html ? x.s : esc(x))).join("") : v instanceof Html ? v.s : v === false || v === null || v === undefined ? "" : esc(v);
    out += part + strings[i + 1]!;
  });
  return new Html(out);
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: string | null | undefined): string {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  return m ? `${MON[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : "";
}
export const fmtMoney = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "" : `$${Math.round(n).toLocaleString("en-US")}`;
/** The public origin. Canonicals, og:url and the sitemap always use it, so the workers.dev copy never competes. */
export const SITE = "https://seedat.dunn.us";
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The address set as sidewalk street tiles: one glazed tile per letter, words kept together. */
export function tiles(text: string, size: "lg" | "md" = "lg"): Html {
  const words = text.toUpperCase().split(/\s+/).filter(Boolean);
  return html`<span class="tiles tiles-${size}" role="img" aria-label="${text}">${words.map((w) =>
    html`<span class="tile-word" aria-hidden="true">${[...w].map((c) => html`<span class="tile">${c}</span>`)}</span>`)}</span>`;
}

/** Page path for the canonical link and og:url; omit it (search results, 404) to emit neither and set noindex. */
export function page(env: Env, opts: { title: string; description: string; body: Html; path?: string; head?: Html }): Response {
  const canonical = opts.path === undefined ? null : SITE + opts.path;
  const analytics = env.UMAMI_SRC && env.UMAMI_WEBSITE_ID
    ? html`<script defer src="${env.UMAMI_SRC}" data-website-id="${env.UMAMI_WEBSITE_ID}"></script>` : "";
  const doc = html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<meta name="description" content="${opts.description}">
${canonical ? html`<link rel="canonical" href="${canonical}">` : html`<meta name="robots" content="noindex">`}
<meta property="og:site_name" content="See Dat">
<meta property="og:type" content="website">
<meta property="og:title" content="${opts.title}">
<meta property="og:description" content="${opts.description}">
${canonical ? html`<meta property="og:url" content="${canonical}">` : ""}
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="See Dat, set in blue sidewalk street tiles">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@75,800&family=IBM+Plex+Mono:wght@400;500&family=Public+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap">
<link rel="stylesheet" href="/style.css">
${opts.head ?? ""}
${analytics}
</head>
<body>
<header class="site">
  <a class="brand" href="/">${tiles("See Dat", "md")}</a>
  <form class="search search-small" action="/search" role="search" aria-label="Find an address">
    <label class="sr-only" for="q-top">Look up a New Orleans address</label>
    <input id="q-top" name="q" type="search" placeholder="Look up an address" autocomplete="off" data-suggest>
  </form>
  <nav><a href="/map">Map</a><a href="/about">About the data</a></nav>
</header>
<main>${opts.body}</main>
<footer class="site">
  <p>See Dat is a free, non-commercial public resource built from City of New Orleans open data. It is not an official city record; check with the city before relying on it.</p>
  <p><a href="/about">Sources, methods and known gaps</a> · <a href="/unplaced">Records we couldn’t place</a></p>
</footer>
<script src="/app.js" defer></script>
</body>
</html>`;
  return new Response(doc.s, { headers: { "content-type": "text/html; charset=utf-8" } });
}
