<!-- ABOUTME: Explains how See Dat matches messy city address strings to canonical parcels, with measured results. -->
<!-- ABOUTME: Implementation lives in packages/core (shared by ingestion and the Workers); this is the "why". -->

# Address matching

Target: at least 98% of permit, code-enforcement and STR records joined to a parcel (GEOPIN), with every join labelled by how it was made.

## What we're matching against

- **Canonical addresses:** the city's LAMA site address points (maps.nola.gov `Addresses/Site_Address_Point_LAMA/0`), 275,122 points. 98.2% carry a GEOPIN, and 270,170 of 270,201 of those GEOPINs exist in the parcel layer.
- **Canonical parcels:** the parcel layer, 151,255 polygons keyed by GEOPIN, each with its own "situs" address in the assessor's abbreviated style (`3210 GRAVIER ST`).

## What we learned by measuring (2026-10-17, 20,000 random permits)

| Step | Matched |
|---|---|
| Uppercase + whitespace only | 0.5% (the address points spell out "Street", the permits say "St") |
| + suffix and directional expansion, unit stripping, leading "St" → "Saint" | **91.4%** |
| Misses: street name not in the address-point dictionary | 5.9% |
| Misses: street known, house number has no address point | 2.3% |
| Misses: not an address at all ("Clouet St and Marais St", "Near 6401 St Claude Ave", "LA Hwy 406") | 0.3% |

The unknown-street misses have three causes, all fixable from city data:

1. **Accents.** The address points use them: *North Villeré Street, South Dupré Street, Sài Gòn Drive, De Boré Drive, Alcée Fortier Boulevard, Père Antoine Alley*. Permits never do. Fix: fold diacritics in the normalizer.
2. **Renamed streets.** The city renamed streets named for Confederates and others (2021–2024). The address points use the new names; old permits and many new applicants use the old ones: *Robert E Lee Blvd → Allen Toussaint Blvd, Jefferson Davis Pkwy → Norman C Francis Pkwy, Caffin Ave → Fats Domino Ave*. Fix: a rename alias table, and the learned aliases below pick these up too.
3. **Style differences.** "2nd St" vs "Second Street", "N Dorgenois" vs "North d'Orgenois", "I-10 Service Rd" vs "Interstate 10 Service Road North", "Le Boeuf" vs "Leboeuf", "A P Tureaud" vs "AP Tureaud".

### Learning aliases from the city's own data

Each address point has a GEOPIN, and each parcel with that GEOPIN has a situs street name in assessor style. When they disagree (`SECOND STREET` vs `2ND ST`, `INTERSTATE 10 SERVICE ROAD NORTH` vs `I 10 W SERVICE RD`), that's an alias, and the number of GEOPINs that agree is its evidence. A first pass found 281 distinct name pairs with 20 or more agreeing parcels. Most are ordinals, "Saint" spellings and highway service roads. Learned aliases need a vote threshold and a majority ratio, because corner parcels produce noise (`LAKE KENILWORTH DRIVE` ↔ `MARTIN DR` is a corner lot pattern, not an alias).

## The normalizer

One TypeScript module, shared by batch ingestion and the Workers, so the address page search and the nightly load agree exactly.

1. Uppercase, fold accents (`É`→`E`), strip punctuation except `/` and `-` inside numbers, collapse whitespace.
2. Cut at the first comma and drop bracketed notes (`[Dillard U Bookstore]`). Keep the remainder for multi-address expansion.
3. Parse the house number: plain (`1234`), half (`1234 1/2`), letter suffix (`1234A`, `5620-C`), range (`4100-4102`, `1234-36` → 1234–1236, `1620/22`).
4. Split the unit: `APT`, `UNIT`, `#`, `STE`, `SUITE`, `BLDG`, `FL`, `RM`, `REAR`, `UPPER`, `LOWER`, `FRONT`, `BACK`.
5. Street to a canonical `street_key` in a short, consistent form: directional prefix (`N`), name, type (`ST`). Ordinals become words (`2ND` → `SECOND`). A leading `ST`/`STE`/`SAINT` becomes `SAINT`; a trailing `ST` is the type. Common prefixes: `GEN` → `GENERAL`, `DR MARTIN LUTHER KING JR` → `MARTIN LUTHER KING JR`.
6. Look the street key up in `street_alias` (canonical, learned, renames, manual) to get the canonical key.

## The match ladder

Records are tried rung by rung. The first rung that produces exactly one parcel wins, and its name goes in `match_type`. A rung that produces two or more parcels is ambiguous and falls through, unless every candidate is the same parcel.

| Rung | `match_type` | How |
|---|---|---|
| 0 | `source_geopin` | The record already carries a GEOPIN that exists in the parcel layer (code cases, hearings, NORA). Permit `pin` values that are 8-digit GEOPINs (about 4% of permits) also count. |
| 1 | `exact` | number + street_key + unit → one address point |
| 2 | `generic_unit` / `base_address` | Unit spelled differently, or the unit isn't in the address points: match the building's base address |
| 3 | `range_member` | Each number in a range or list (`8632 Cohn St, 8634 Cohn St`) → must agree on one parcel. If they span parcels, the first becomes the primary and the others are recorded |
| 4 | `alias` | Same as 1–2 after alias substitution (counted separately so we can see how much aliases buy) |
| 5 | `parcel_situs` | Match against the parcel layer's own situs number + street (it has addresses the point layer lacks) |
| 6 | `fuzzy_street` | Street within edit distance 1–2 of a canonical street *that has this house number*, unique. Score by distance |
| 7 | `tax_bill` | Permit `pin` → GEOPIN from our learned `tax_bill_geopin` crosswalk (seeded by rungs 1–6) |
| 8 | `nearest_point` | Records with coordinates (rcm3, aib5, STR, business licences): the nearest address point within 30 m, via the grid `cell` index. Must agree with the street name if there is one |
| — | `unmatched` | Kept, with the reason, in the `unmatched` view |

Each rung reports a `match_score`: 1.0 for rungs 0–2, slightly lower for rungs 3–5, distance-based for 6 and 8.

## Validation

- **Unit tests** for the normalizer, with every pattern above as a fixture: accents, renames, ranges, halves, units, ordinals, bracketed notes.
- **Coverage report** per source and rung, generated after every load and stored in `snapshot` stats. The validation report quotes it.
- **The 50-address spot check:** 50 random addresses across neighborhoods, checked by hand against One Stop and data.nola.gov by a separate agent, with every miss recorded. This becomes an automated regression test against frozen fixtures.
- **The "couldn't place these" page** publishes the misses. That's both honest and the feedback loop to the city.
