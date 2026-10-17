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
