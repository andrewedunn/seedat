<!-- ABOUTME: Front page of the See Dat repository: what it is, where it runs, and where to read more. -->
<!-- ABOUTME: Details live in the linked docs; keep this short. -->

# See Dat

Every public record about a New Orleans property, on one page: permits and their timelines, inspections, code enforcement, short-term rental licenses, zoning and historic-district rules, and block-level 311 and police activity. It's a free, non-commercial public resource built from the City of New Orleans' own open data.

- **Website:** https://seedat.dunn.us
- **MCP server for AI agents:** `https://seedat.dunn.us/mcp` (see [workers/api/README.md](workers/api/README.md))

## How it works

The city publishes its data across systems that don't share IDs. See Dat pulls them every night, keeps a raw copy of every pull, and joins every record to one parcel with an address matcher that learns street aliases, renamed streets and the assessor's tax-bill crosswalk from the city's own data. Match rates:

- **Property permits:** 98.2%
- **Short-term rental licenses:** 99.1%
- **Code enforcement cases:** 96.5%

| Piece | Where |
|---|---|
| Address normalizer, matcher, source adapters | [`packages/core`](packages/core) |
| Shared D1 queries (pages and MCP) | [`packages/d1`](packages/d1) |
| Nightly ingest Workflow and One Stop crawler | [`workers/ingest`](workers/ingest) |
| Website (property pages, search, map) | [`workers/web`](workers/web) |
| MCP server | [`workers/api`](workers/api) |
| Schema (Cloudflare D1) | [`db/migrations`](db/migrations), explained in [docs/schema.md](docs/schema.md) |

## Read more

- [PRIOR_ART.md](PRIOR_ART.md): what already exists and where See Dat fits
- [SOURCES.md](SOURCES.md): every source, cadence and join key
- [docs/address-matching.md](docs/address-matching.md): how messy addresses become parcels
- [VALIDATION.md](VALIDATION.md): coverage, freshness, match rates, and the 50-address spot check
- [FINDINGS.md](FINDINGS.md): three things in the data nobody asked about
- [NOTES.md](NOTES.md) and [JOURNAL.md](JOURNAL.md): decisions, dead ends and the build story

## Development

```bash
npm install
```

```bash
npx vitest run
```

Each Worker deploys with `npx wrangler deploy` from its folder. Database changes are migrations in `db/migrations`, applied with `npx wrangler d1 migrations apply seedat-db --remote` from `workers/ingest`.

## Data and terms

The city data is CC0 or published without a license on data.nola.gov. NOPD calls for service may not be used commercially or to identify specific addresses, so See Dat shows them only as block-level counts. Phone numbers and email addresses are never republished. See Dat is not an official city record.
