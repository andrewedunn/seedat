<!-- ABOUTME: README for the See Dat MCP server: how to connect, the tools, and example questions it answers well. -->
<!-- ABOUTME: The server code is workers/api/src; queries are shared with the website through packages/d1. -->

# See Dat MCP server

A free, read-only [Model Context Protocol](https://modelcontextprotocol.io) server for New Orleans property and permit records. It gives any AI agent the same joined-up data as the See Dat property pages:

- building permits, with status timelines and, where crawled, inspections
- code enforcement cases, with their inspections, violations and hearings
- One Stop records, including HDLC and Vieux Carré reviews
- short-term rental licenses
- zoning and historic-district rules
- block-level 311 and police activity

Every record is matched to a parcel, so agents never write SQL or learn dataset IDs.

**Endpoint:** `https://seedat.dunn.us/mcp` (Streamable HTTP, stateless, no auth).

## Connect

Claude Code:

```bash
claude mcp add --transport http seedat https://seedat.dunn.us/mcp
```

Any client that speaks Streamable HTTP can use the URL above. The server answers `initialize`, `tools/list` and `tools/call` with plain JSON, without sessions or streaming.

## Tools

| Tool | Use it for |
|---|---|
| `lookup_address` | One property: parcel ID, neighborhood, zoning in plain English, historic district and review rules, a plain-English summary, and counts of records. Handles messy input ("1234 st claude apt b"). |
| `get_property_records` | Everything on file for one property, newest first, filterable by kind and date, with timelines. |
| `search_permits` | Citywide permit search: neighborhood (loose names work: "7th ward", "Treme"), council district, ward, historic district, permit type, description words, cost range, date range, open/closed. Returns `total`. |
| `find_properties` | Parcels matching conditions: open code case, active short-term rental, no permit since a date, demolition since a date, HDLC control, zoning prefix. Returns `total`. |
| `block_activity` | 311 requests and police calls on the hundred-block around an address. |
| `data_freshness` | When each source was last pulled, and the One Stop crawl's progress. |
| `list_values` | Valid values, with counts, for neighborhood, permit type, ward, council district, historic district, zoning, and One Stop record type. |

Every answer includes `as_of` (the latest successful pull), a `provenance` note, and `page_url` links to the human-readable property pages.

## Five questions it answers well

These were run against the live server on 2026-10-17.

1. **"What's going on at 900 Royal Street?"** `lookup_address {address: "900 royal st"}`, then `get_property_records`. VCC-1 zoning in the Vieux Carré, so all exterior work, including paint, needs Vieux Carré Commission approval. 27 permits, 17 still open in the city’s records.
2. **"Demolition permits filed in Bywater since June 2026."** `search_permits {neighborhood: "Bywater", type: "DEMO", since: "2026-06-01"}`. 3 permits, with descriptions and status. Adding `min_cost: 100000` returns 0, because applicants usually leave the estimated cost of a demolition at $0. The tool description tells agents this.
3. **"Properties in the Seventh Ward with open code cases and no permit activity in two years."** `find_properties {neighborhood: "7th ward", open_code_case: true, no_permit_since: "2024-10-17"}`. 516 properties.
4. **"Which Tremé properties have an active short-term rental license?"** `find_properties {neighborhood: "Treme", str_active: true}`. 102 properties.
5. **"Recent solar installs with battery backup."** `search_permits {type: "SOLR", text: "battery", since: "2026-07-19"}`. Full-text search over permit descriptions.

## Ground rules baked in

- **Police calls are block-level only.** NOPD's terms forbid deriving specific addresses or commercial use. `block_activity` reports counts for the hundred-block and says so.
- **No phone numbers or email addresses** appear anywhere, even where the city publishes them.
- **Estimated costs are the applicant's own figures**, and statuses are the city's. "Open" means open in the city's records, which includes many old permits that were never formally closed.
- This is not an official city record. Check One Stop before relying on a status.
