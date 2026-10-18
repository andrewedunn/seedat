# Property rules research (for packages/core/src/rules.ts)

Researched 2026-10-17. VERIFIED = read on an official nola.gov / czo.nola.gov / council.nola.gov page.

## HDLC full control (VERIFIED)
- HDLC has jurisdiction over any part of a property visible from a public right-of-way; all exterior work except paint color and plantings needs review before work starts. "All exterior repairs, no matter how minor" need a CofA. Re-painting and paint color are not reviewed; interiors are not reviewed. https://nola.gov/nola/media/HDLC/Guidelines/01-Introduction.pdf (pp. 01-4, 01-7); FAQ: https://nola.gov/NEXT/HDLC/Topics/Frequently-Asked-Questions
- Staff vs commission: in-kind repair/replacement is staff-approved; staff can also approve work meeting the Guidelines, additions/accessory structures under 500 sf, roofline alterations (Executive Director), and demolition of non-contributing auxiliary structures/additions up to 1,000 sf. Everything else goes to a Commission public hearing (ARC advises). https://nola.gov/nola/media/HDLC/Guidelines/16-Rules-Regulations.pdf (Sec. V.A)
- Full-control districts (2017 chart): Algiers Point, Bywater, Canal St, Carrollton Ave, Esplanade Ave, Faubourg Marigny, Garden District, Holy Cross, Irish Channel, Lafayette Square, Lower Garden District, Picayune Place, St. Charles Ave, Tremé (riverside of Claiborne), Warehouse District. (Intro p. 01-5.)

## HDLC partial control (VERIFIED, corrects the brief)
- Uptown, Parkview, Carrollton (outside Carrollton Ave), Mid-City: demolition review ONLY; HDLC has no other jurisdiction. Demolition = removing/obscuring >half an exterior wall or roof, altering >25% of primary-facade historic material, or raising to create habitable space, within 5 years. https://nola.gov/next/hdlc/topics/demolition-review/
- Esplanade Ridge (outside Esplanade Ave) and Tremé lake side of Claiborne: demolition + demolition by neglect + "review and comment" on visible exterior changes (no approval power). Intro chart p. 01-5; Guidelines p. 01-4 defines the categories. Note: "new construction" is NOT checked for these in the 2017 chart (older CPC proposals said Mid-City included new construction; not adopted per chart).
- Caveat: the chart marks Garden District with demolition/DBN/new-construction boxes in addition to full control; likely a rendering quirk, treated as full control.

## Landmarks (VERIFIED)
- HDLC reviews all exterior work on individual landmarks (not limited to street-visible areas), plus demolition. Nominated buildings are under HDLC jurisdiction during the study period. Intro p. 01-4/01-7; https://nola.gov/NEXT/HDLC/Topics/Landmarks-and-Districts

## Vieux Carré Commission (VERIFIED)
- All exterior work needs a VCC permit whether or not visible, including painting (even to match), courtyard paving, fencing, roofing. Interior only if structural or affecting exterior. Staff can issue permits in about 2-7 working days for ordinary maintenance/repair or work under adopted policies; the Commission ratifies decisions. https://nola.gov/NEXT/Vieux-Carre-Commission/Topics/Application-Process ; paint: https://nola.gov/paint-permit-vcc/ ; https://nola.gov/vcc/
- Not read in full (the VCC page was truncated): exact commission-vs-staff chart, demolition rules. Not claimed in rules.ts.

## Solar panels (PARTIAL)
- VERIFIED: the city's "HDLC Solar Panel Review Area" = all full-control districts, Esplanade Ridge and Tremé partial-control districts, and all nominated/designated landmarks; structures in it need HDLC review before a solar permit is issued. https://maps.nola.gov/server/rest/services/Resilience/HDLC_Solar_Panel_Review_Area/MapServer/info/iteminfo
- UNVERIFIED: the current solar guideline text (what staff may approve vs Commission). PRC (secondary) reports staff proposed a 2026-era revision to let staff approve more; outcome of the April vote not confirmed. https://prcno.org/hdlc-staff-proposes-new-solar-panel-guidelines/ (prcno.org returned 403 to fetch; only seen in search snippets.) rules.ts deliberately says only "review required".

## National Register (VERIFIED, with a correction)
- Listing alone: "the only protection provided by the National Register designation is limited control over federally funded projects" (HDLC FAQ). BUT: in National Register districts that are not local districts, demolition needs City Council review/approval (New Marigny, Central City, Broadmoor, Gentilly Terrace, South Lakeview, Pontchartrain Park, ...). Exempt: single-story hidden accessory structures, <25% floor area with no primary facade, HDLC/VCC properties (reviewed there), CBD, buildings absent from 1983 Sanborn maps, emergencies. https://nola.gov/demolitions-in-national-register-demolition-review-district/
- Tax credits: UNVERIFIED as a local rule; the Guidelines intro mentions tax-credit eligibility only generally. Omitted.

## Neighborhood Conservation District (UNVERIFIED)
- Only secondary sources (PRC, council agendas): NCDAC advises City Council on demolition permits in the NCD (roughly river to Florida Ave outside HDLC/VCC districts); Ord. 31,152 (2016) exempts hidden single-story accessory structures and partial demolitions not touching the primary facade. No official nola.gov page read; the CZO has no NCD overlay article I could find. rules.ts emits this rule only if overlays contains "NCD", with verified=false.

## Interim zoning districts
- Transient Lodging IZD (VERIFIED in CZO): CZO 19.4.A.23, adopted Ord. 30625 MCS, 5-7-26, Zoning Docket 006/25. Hotels/motels, hostels, B&Bs, commercial STRs and timeshares become conditional uses needing Council approval where otherwise permitted. Term: CZO 19.3.B.3 sets one year plus up to two 180-day extensions; this IZD's own text has no expiry clause, so about 2027-05-07 is DERIVED, not stated. https://czo.nola.gov/article-19/
- Data Center IZD (PARTIAL): Council approved motions M-26-62 (define data centers) and M-26-63 (interim district) on 2026-01-28; reported as a citywide one-year pause on data center approvals/licenses, extendable under Charter 3-126. https://council.nola.gov/news/january-2026/new-orleans-city-council-approves-motions-to-study/ . UNVERIFIED: the adopting ordinance number/effective date (not yet listed in CZO Art. 19 as of fetch), end date (about late Jan 2027 if no extension), and whether M-26-174 (6-month extension, per a CPC staff report) passed. Permanent rules: ZD 036/26, CPC deferred 8/25/26, consideration deadline 10/23/26 (secondary: zonewire.co, veritenews.org).

## CZO district purposes (VERIFIED)
Purpose statements read from https://czo.nola.gov/article-6/ through /article-18/ (each page embeds all articles; e.g. HU residential Art. 11, S residential Art. 13, commercial Art. 15, industry Art. 16, CBD Art. 17, French Quarter/Marigny Art. 9-10, open space Art. 7). One-liners in DISTRICTS in rules.ts paraphrase these; pattern fallbacks cover S-L*, CBD-*, VC*, HM*, HU-*, S-*, OS-*.
