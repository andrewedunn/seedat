// ABOUTME: The smaller pages of seedat-web: home, search results, the parcel map, about the data, and the list of
// ABOUTME: records we could not place. The property page lives in property-page.ts.
import type { Suggestion } from "@seedat/d1/src/search";
import { titleCase } from "@seedat/core/src/summary";
import { type Env, SITE, fmtDate, html, page, raw, slug, tiles } from "./html";

export function home(env: Env, stats: { parcels: number; permits: number; updated: string | null }): Response {
  return page(env, {
    title: "See Dat — every public record for a New Orleans property",
    path: "/",
    head: html`<script type="application/ld+json">${raw(JSON.stringify({
      "@context": "https://schema.org", "@type": "WebSite", name: "See Dat", url: `${SITE}/`,
      potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    }))}</script>`,
    description: "Look up any New Orleans address: permits, inspections, code enforcement, short-term rental licenses, zoning, historic district rules, and block-level 311 and police activity, in one place.",
    body: html`
<section class="hero">
  <h1>${tiles("See Dat")}</h1>
  <p class="lede">Every public record about a New Orleans property, on one page: permits and inspections, code enforcement, short-term rental licenses, zoning and historic district rules, and what’s happening on the block.</p>
  <form class="search search-big" action="/search" role="search" aria-label="Look up an address">
    <label for="q">Address</label>
    <input id="q" name="q" type="search" placeholder="e.g. 3300 Dauphine St" autocomplete="off" autofocus data-suggest>
    <button type="submit">Look up</button>
  </form>
  <p class="hero-meta">${stats.parcels.toLocaleString("en-US")} parcels · ${stats.permits.toLocaleString("en-US")} permits · updated ${fmtDate(stats.updated)} · <a href="/map">Browse the map</a></p>
</section>`,
  });
}

export function searchResults(env: Env, q: string, suggestions: Suggestion[], reason: string | null): Response {
  const why: Record<string, string> = {
    unknown_street: "We don’t recognize that street name.",
    number_not_found: "That street exists, but we have no address at that number.",
    ambiguous: "That address matches more than one parcel.",
    unparseable: "That doesn’t look like a street address. Try a house number and street, like 1234 Saint Claude Ave.",
    block_level: "That’s a block, not a single address. Add a house number.",
  };
  return page(env, {
    title: `No exact match for “${q}” — See Dat`,
    description: "Address search results",
    body: html`<section class="narrow">
      <h1 class="plain">No exact match for “${q}”</h1>
      ${reason && why[reason] ? html`<p>${why[reason]}</p>` : ""}
      ${suggestions.length ? html`<h2>Did you mean</h2><ul class="suggest-list">${suggestions.map((s) => html`<li><a href="/p/${s.geopin}/${slug(s.full_address)}">${s.full_address}</a>${s.neighborhood ? html` <span>${titleCase(s.neighborhood)}</span>` : ""}</li>`)}</ul>` : ""}
      <form class="search search-big" action="/search" role="search" aria-label="Look up an address"><label for="q2">Try another address</label><input id="q2" name="q" type="search" value="${q}" autocomplete="off" data-suggest><button type="submit">Look up</button></form>
    </section>`,
  });
}

export function mapPage(env: Env): Response {
  return page(env, {
    title: "Map — See Dat",
    path: "/map",
    description: "Browse New Orleans parcels by recent permits, open code enforcement cases, demolitions, short-term rentals and historic districts.",
    head: html`<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css">
<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js" defer></script>
<script src="https://unpkg.com/pmtiles@3.2.1/dist/pmtiles.js" defer></script>
<script src="/map.js" defer></script>`,
    body: html`<section class="mapwrap">
  <div class="map-controls" role="group" aria-label="Show parcels with">
    <p class="eyebrow">Show parcels with</p>
    ${[["permits_90d", "A permit filed in the last 90 days"], ["open_cases", "An open code enforcement case"], ["demolition", "A demolition permit (past 5 years)"], ["str_active", "An active short-term rental license"], ["hdlc_full", "Full HDLC historic control"]]
      .map(([v, l], i) => html`<label class="chip"><input type="radio" name="layer" value="${v}"${i === 0 ? raw(" checked") : ""}> ${l}</label>`)}
    <p class="map-count" aria-live="polite"></p>
  </div>
  <div id="map" role="region" aria-label="Map of New Orleans parcels"></div>
  <div class="map-card" aria-live="polite" hidden></div>
</section>`,
  });
}

export function about(env: Env, sources: { source_id: string; name: string; url: string; license: string | null; last_success_at: string | null; last_row_count: number | null }[], match: { entity: string; match_type: string; n: number }[]): Response {
  const totals = new Map<string, number>();
  for (const m of match) totals.set(m.entity, (totals.get(m.entity) ?? 0) + m.n);
  const rate = (e: string) => {
    const t = totals.get(e) ?? 0;
    const placed = match.filter((m) => m.entity === e && m.match_type !== "unmatched").reduce((s, m) => s + m.n, 0);
    return t ? `${(100 * placed / t).toFixed(1)}%` : "—";
  };
  return page(env, {
    title: "About the data — See Dat",
    path: "/about",
    description: "Where See Dat’s data comes from, how often it updates, and how records are matched to parcels.",
    body: html`<section class="narrow prose">
<h1 class="plain">About the data</h1>
<p>See Dat pulls the City of New Orleans’ own published data every night, keeps a copy of every pull, and joins it all to a single parcel so one address shows everything. Nothing here is new information; it is the city’s information, put in one place.</p>
<h2>How records are matched to parcels</h2>
<p>City systems describe the same property differently: permits use the assessor’s tax bill number, code enforcement uses the city’s parcel ID, and most records carry only a typed address like “1234 St Claude Ave Apt B”. We clean each address (spelling, abbreviations, accents, units, ranges, renamed streets), match it against the city’s official address points, and record how each match was made. Records we can’t place are <a href="/unplaced">listed openly</a>.</p>
<p>Event permits (parades, second lines, special events, floats) are not counted here: they describe an event at a place, not work on a property, so we don’t attach them to a parcel by proximity.</p>
<table class="table"><thead><tr><th>Records</th><th>Placed on a parcel</th></tr></thead><tbody>
${[["permit", "Permits"], ["code_case", "Code enforcement cases"], ["str_license", "Short-term rental licenses"]].map(([e, l]) => html`<tr><td>${l}</td><td>${rate(e!)}</td></tr>`)}
</tbody></table>
<h2>Sources and freshness</h2>
<table class="table"><thead><tr><th>Dataset</th><th>Rows</th><th>Last pulled</th><th>License</th></tr></thead><tbody>
${sources.map((s) => html`<tr><td><a href="${s.url.replace("/resource/", "/d/").replace(".json", "")}" rel="noopener">${s.name}</a></td><td>${s.last_row_count?.toLocaleString("en-US") ?? ""}</td><td>${fmtDate(s.last_success_at)}</td><td>${s.license ?? "not stated"}</td></tr>`)}
</tbody></table>
<h2>What we leave out on purpose</h2>
<ul>
<li>Phone numbers and email addresses, even where the city publishes them.</li>
<li>Exact locations for 311 requests and police calls. Both are shown only as counts for the block. NOPD’s terms forbid deriving specific addresses from its data or using it commercially.</li>
<li>Scores or ratings of properties or owners.</li>
</ul>
<h2>Known gaps</h2>
<ul>
<li>Inspection results and plan review comments come from One Stop’s public record pages, which we read slowly (one page a minute) to stay polite. Recent records are covered first.</li>
<li>Owner, assessed value and sales history are not included; the Assessor does not publish a bulk file.</li>
<li>Flood zones are not yet included.</li>
</ul>
</section>`,
  });
}

export function unplaced(env: Env, rows: { entity: string; entity_id: string; address_raw: string | null; match_type: string }[], counts: { entity: string; n: number }[]): Response {
  const label: Record<string, string> = { permit: "Permit", code_case: "Code case", str_license: "Rental license" };
  return page(env, {
    title: "Records we couldn’t place — See Dat",
    path: "/unplaced",
    description: "City records whose address we could not match to a parcel.",
    body: html`<section class="narrow prose">
<h1 class="plain">Records we couldn’t place</h1>
<p>These city records have an address we could not match to a single parcel: often a typo, a vacant lot with no official address, an intersection, or a street renamed after the record was filed. ${counts.map((c) => `${c.n.toLocaleString("en-US")} ${label[c.entity]?.toLowerCase() ?? c.entity}s`).join(", ")} in all. The most recent are below.</p>
<table class="table"><thead><tr><th>Record</th><th>Address as the city wrote it</th></tr></thead><tbody>
${rows.map((r) => html`<tr><td>${label[r.entity] ?? r.entity} <code>${r.entity_id}</code></td><td>${r.address_raw ?? "(no address)"}</td></tr>`)}
</tbody></table>
</section>`,
  });
}

export function notFound(env: Env): Response {
  const r = page(env, { title: "Not found — See Dat", description: "Page not found", body: html`<section class="narrow"><h1 class="plain">No page here</h1><p>Look up an address instead, or <a href="/map">browse the map</a>.</p></section>` });
  return new Response(r.body, { status: 404, headers: r.headers });
}
