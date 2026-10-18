<!-- ABOUTME: One-page summary of three things the See Dat data shows that nobody asked about. -->
<!-- ABOUTME: Numbers from seedat-db on 2026-10-17; queries are reproducible against the schema in db/migrations. -->

# Three things in the data nobody asked about

All numbers come from the City of New Orleans' own published records, joined to parcels by See Dat, as of October 17, 2026. They describe what the city's records say, which isn't always what happened on the ground.

## 1. In full-control historic districts, permits take about twice as long, and new construction about three times

Median days from application to issuance, for permits filed since January 2024 (French Quarter excluded; the Vieux Carré Commission reviews there, not the HDLC):

| Permit | Full HDLC control | Partial control | Not in a local district |
|---|---|---|---|
| New construction | **208 days** (n=36) | 80 (n=123) | 66 (n=793) |
| Structural renovation | **76** (n=306) | 53 (n=692) | 43 (n=849) |
| Non-structural renovation | **45** (n=782) | 36 (n=1,043) | 31 (n=2,775) |

The difference follows the rules. In full-control districts nearly all visible exterior work needs a Certificate of Appropriateness. Partial-control districts review only demolition, and they land in between.

Caveats:
- This is correlation, not cause. Projects in historic districts may also be more complex.
- The new-construction sample under full control is small.

Even so, it is the first city-wide number we know of for what historic review costs an applicant in time. It is the kind of public view of permit timing that State Rep. Matthew Willard called for in 2025 (Gambit, October 4, 2025). It's also the training data a permit-time predictor would start from.

## 2. 8,287 code-enforcement cases have sat at "Judgment" for an average of 7.8 years

The city's code-enforcement pipeline runs Inspection → Title Research → Hearing → Judgment → In Compliance → Closed. Of the cases still open:

| Stage | Open cases | Average age |
|---|---|---|
| Inspection | 1,358 | 0.2 years |
| Title Research | 2,128 | 2.0 years |
| Hearing | 2,665 | 0.9 years |
| **Judgment** | **8,287** | **7.8 years** (oldest: June 2010) |
| In Compliance | 72 | 13.9 years |

More than half of all open cases are past judgment and have stayed there for most of a decade. That likely means properties found in violation, with fines or liens imposed, that were never brought into compliance or formally closed.

For neighborhood groups watching blight, these are the properties where the city has already won its case and nothing visible has followed. It's a ready-made list for a blight early-warning project.

## 3. Over 100,000 permits from 2012–2020 are still "open" on paper

Ask the city's data how many permits are open and you get about 92,000. Most of them aren't active work. They're permits issued years ago that were never formally closed out: 17,000–19,000 a year for 2012–2014, and 6,500–10,600 a year for 2015–2020, still sitting at "Permit Issued".

Any "open permits" count, or a buyer's check for open permits on a house, mostly measures old paperwork. See Dat labels these as "open in the city's records". A next step would be to flag permits that have been open five years or more with no inspection on file.

## Also noticed

- **The city's two parcel ID systems don't talk to each other.**
  - Permits use the assessor's tax-bill number; everything else uses the GIS "GEOPIN", and no public crosswalk exists.
  - See Dat learned one from permits it could place by address: 76,544 tax bills linked to parcels.
- **Old street names live on in records.** Records filed after the renamings still use the former names, for example *Caffin Ave* for Fats Domino Ave and *Jefferson Davis Pkwy* for Norman C. Francis Pkwy. The matcher learned these renames from coordinates, not from a list.
- **Two interim zoning districts cover nearly the whole city:** data centers and transient lodging.
- **One Stop holds record types that aren't in any open dataset.** These include HDLC Certificates of Appropriateness, Vieux Carré reviews, special events, film permits and dumpster permits.
