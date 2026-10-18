<!-- ABOUTME: Narrative build log of See Dat, written as raw material for a blog post, article, or thread. -->
<!-- ABOUTME: Each entry: what we tried, what we learned, and the surprising bit worth sharing. -->

# Building See Dat — journal

## 2026-10-17 — Day 1: research before code

The brief: one database for every public fact about every New Orleans property, fresher than the city's own monthly reports, with an MCP server so any AI agent can ask it questions.

The first rule we set ourselves was to write no code until we knew what already exists. One orchestrating agent fanned the work out to seven research agents running in parallel: three on prior art (New Orleans tools, other cities, commercial products) and four on the raw sources (One Stop, data.nola.gov, the city's ArcGIS servers, and the assessor and address authorities). Each wrote a file and sent back a short summary, so the orchestrator's own context stays free for the decisions.

### What the research changed

- **The city already publishes nightly.** The brief assumed permit data was "a month stale" because the One Stop reports are monthly. The open data portal refreshes permits, code enforcement, STR and 311 every night. Freshness was never the hard problem; joining is.
- **The city runs two parcel ID systems and publishes no crosswalk between them.** Permits carry the assessor's tax-bill number; code enforcement, address points and parcels carry the GIS "GEOPIN". A dataset literally named "Parcels To Join" looked like the bridge. An independent validator agent tested it: 0 of 500 permit IDs matched. The first-pass research agent had said it was the crosswalk. *Never let an agent check its own work* paid for itself here.
- **Address matching, measured:** a naive match of permit addresses to the city's own address list hits 0.5%, because the address list spells out "Street" and the permits say "St". Basic normalization gets 93%. The last 5 points to 98% are the actual project.
- **Three permit datasets that aren't the same.** The nightly "Permits" dataset quietly leaves out about half of recent permits (no plumbing, no historic-district permits). You only notice by comparing counts.

### The database call, with numbers

Should a parcel-and-permit site need PostGIS? We loaded 3.2M real rows into Cloudflare D1 and timed the address page: 25 ms median inside the Worker, 125 ms end-to-end including the TLS handshake. The spatial work (which zoning district, which historic district) happens once at ingest and gets written onto each parcel row, so the website never asks a spatial question. Boring stack, held.

### Building the matcher: let the city's data correct itself

The address matcher went from 0.5% to 98% in an afternoon, and most of the gain came from the city's own data rather than hand-written rules:

- **Accents.** The city's address list writes *North Villeré Street*, *South Dupré Street*, *Sài Gòn Drive*. Permits never use the accents. Folding them fixed thousands of misses.
- **Street aliases from shared parcel IDs.** Every address point and every parcel carries a GEOPIN. Where the two spell the street differently ("SECOND STREET" vs "2ND ST", "INTERSTATE 10 SERVICE ROAD NORTH" vs "I 10 W SERVICE RD"), that pair is an alias, and the number of parcels that agree is its evidence. That gave 116 aliases with no hand-written list.
- **Renamed streets from coordinates.** For STR and code-enforcement records whose street name is unknown, the nearest address point "votes" on what the name means. The top results were the city's street renamings: *Caffin Ave → Fats Domino Ave* (421 votes), *S Jefferson Davis Pkwy → S Norman C Francis Pkwy*, *Cadillac St → Roneagle Way*. Old names persist in records long after the signs change.
- **The crosswalk nobody publishes.** Permits carry the assessor's tax-bill number; everything else uses the city's GEOPIN. By placing permits on parcels by address first, we learned **76,544 tax-bill → parcel links**. That's a dataset in itself, and we plan to publish it.

Final rates over every record, not a sample: permits 98.1% of 493,625; STR 99.1% of 40,820; code cases 96.5% of 183,007 (the misses are mostly a 2009 data migration).

### The One Stop surprise

The city's permitting system publishes a read-only detail page for every record, but it rate-limits hard. About a dozen requests and you get "Too many requests in a short time." One request a minute is sustainable, and the full history would take about two years. The "Download permit CSV" link on every page is a honeypot for bots.

The bigger surprise was what those pages hold. One Stop's ID sequence covers far more than building permits: HDLC Certificates of Appropriateness, Vieux Carré Commission reviews, special events, film locations, dumpster permits, curb cuts. As far as we can tell, none of those are in any open dataset. So the crawler became a source in its own right. It runs on a one-minute Cloudflare cron, newest records first.

### Things D1 taught us

- Statements over 100 KB are rejected, so batches are capped by bytes, not rows.
- Wrangler can print an ERROR and still exit 0. Our first geography load "succeeded" into empty tables.
- Rehearse every load in local SQLite first. Two constraint bugs that would have each cost an hour-long remote load were found in about three minutes locally.

## 2026-10-18 — Launch

See Dat went live at seedat.dunn.us: every New Orleans parcel has a page, and any MCP-speaking agent can query the same data at /mcp.

The most useful agent in the whole project was the one that checked the work. Given 50 random addresses and told to find where the site was wrong, it found four things the builder had missed:
- lists silently capped at 200 permits;
- 2025's bulk "Closed" status not being recognised;
- parade permits attached to whichever house was nearest the route;
- permits for "1835-1839 Louisa St" showing on only one of the two houses.

Fixing those moved record recall from 87% to 99%. The cheapest quality step is still a second pair of eyes that didn't write the code.
