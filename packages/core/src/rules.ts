// ABOUTME: Plain-English "rules for this property": which historic or zoning review applies to a parcel, with sources.
// ABOUTME: Content is distilled from nola.gov (HDLC, VCC, City Planning) and the CZO; see research/rules.md for provenance.

export interface Rule { title: string; body: string; sourceUrl: string; verified: boolean }

export interface ParcelRuleInput {
  zoning: string | null;
  zoning_desc: string | null;
  overlays: string[];
  local_historic_district: string | null;
  hdlc_control: "Full" | "Partial" | null;
  nr_district: string | null;
  is_landmark: boolean;
  hdlc_solar_review: boolean;
}

const HDLC_GUIDELINES = "https://nola.gov/nola/media/HDLC/Guidelines/01-Introduction.pdf";
const HDLC_FAQ = "https://nola.gov/NEXT/HDLC/Topics/Frequently-Asked-Questions";
const HDLC_DEMO = "https://nola.gov/next/hdlc/topics/demolition-review/";
const HDLC_LANDMARKS = "https://nola.gov/NEXT/HDLC/Topics/Landmarks-and-Districts";
const VCC_PROCESS = "https://nola.gov/NEXT/Vieux-Carre-Commission/Topics/Application-Process";
const SOLAR_AREA = "https://maps.nola.gov/server/rest/services/Resilience/HDLC_Solar_Panel_Review_Area/MapServer/info/iteminfo";
const NR_DEMO = "https://nola.gov/demolitions-in-national-register-demolition-review-district/";
const CZO_ART19 = "https://czo.nola.gov/article-19/";
const DATA_CENTER = "https://council.nola.gov/news/january-2026/new-orleans-city-council-approves-motions-to-study/";

// Partial-control districts where the HDLC also reviews visible changes and comments (no approval power).
const REVIEW_AND_COMMENT = /esplanade ridge|trem[eé]/i;

function vccRule(): Rule {
  return {
    title: "Vieux Carré Commission review",
    body: "You need a Vieux Carré Commission permit before any exterior work, including painting and roofing, whether or not it is visible from the street. Staff can approve ordinary repairs; bigger changes go to the Commission. Interior work is only reviewed if it affects the structure or the exterior.",
    sourceUrl: VCC_PROCESS,
    verified: true,
  };
}

function hdlcRule(p: ParcelRuleInput): Rule | null {
  const where = p.local_historic_district ? `the ${p.local_historic_district} local historic district` : "a local historic district";
  if (p.hdlc_control === "Full") {
    return {
      title: "HDLC review of exterior work",
      body: `This property is in ${where}. You need HDLC approval (a Certificate of Appropriateness) before exterior work visible from a public street, including repairs, new windows, doors and roofs, fences, additions, and demolition. Re-painting and choosing paint colors are not reviewed, and neither are interiors or plants. Staff approve in-kind repairs and some other work; larger changes go to the Commission.`,
      sourceUrl: HDLC_GUIDELINES,
      verified: true,
    };
  }
  if (p.hdlc_control === "Partial") {
    const extra = p.local_historic_district && REVIEW_AND_COMMENT.test(p.local_historic_district)
      ? " The HDLC can also review visible exterior changes and give comments, but cannot require changes, and it can cite a building for demolition by neglect."
      : "";
    return {
      title: "HDLC demolition review",
      body: `This property is in ${where}, which has partial HDLC control. You need HDLC approval for demolition, which includes removing more than half of an exterior wall or roof. Other exterior work is not reviewed.${extra}`,
      sourceUrl: HDLC_DEMO,
      verified: true,
    };
  }
  return null;
}

export function rulesForParcel(p: ParcelRuleInput): Rule[] {
  const rules: Rule[] = [];
  const inVcc = /^VC/i.test(p.zoning ?? "") || /vieux carr/i.test(p.local_historic_district ?? "");
  const hdlc = inVcc ? null : hdlcRule(p);

  if (inVcc) rules.push(vccRule());
  if (hdlc) rules.push(hdlc);
  if (p.is_landmark) {
    rules.push({
      title: "HDLC landmark",
      body: "This building or site is an HDLC landmark. You need a Certificate of Appropriateness for any exterior work, whether or not it is visible from the street, and for demolition or moving it.",
      sourceUrl: HDLC_GUIDELINES,
      verified: true,
    });
  }
  if (p.hdlc_solar_review) {
    rules.push({
      title: "Solar panels need HDLC review",
      body: "Solar panel permits here need HDLC review before the city issues them. The details of what staff can approve versus the Commission are not confirmed here, so check with the HDLC before you order panels.",
      sourceUrl: SOLAR_AREA,
      verified: true,
    });
  }
  if (p.nr_district && !inVcc && !hdlc && !p.is_landmark) {
    rules.push({
      title: "National Register district",
      body: "National Register listing alone does not limit what you do to the outside of your building; it mainly covers federally funded or permitted projects. Demolition in a National Register district that is not also a local historic district goes to City Council for approval, with exceptions for small sheds and garages and for removing under 25 percent of floor area without touching the front.",
      sourceUrl: NR_DEMO,
      verified: true,
    });
  }
  if (p.overlays.some((o) => /^NCD\b/i.test(o)) && !inVcc && !hdlc && !p.is_landmark) {
    rules.push({
      title: "Neighborhood Conservation District",
      body: "Demolition here is reviewed by the Neighborhood Conservation District Advisory Committee and decided by City Council. Small hidden sheds and demolitions that leave the front of the building alone are generally exempt.",
      sourceUrl: NR_DEMO,
      verified: false,
    });
  }
  if (!inVcc && !hdlc && !p.is_landmark && !p.nr_district) {
    rules.push({
      title: "No local historic district review",
      body: "This property is not in a local historic district or an HDLC landmark in our data, so the HDLC and Vieux Carré Commission do not review work here. You still need the usual building and zoning permits.",
      sourceUrl: HDLC_LANDMARKS,
      verified: true,
    });
  }
  if (p.zoning) {
    rules.push({
      title: "Transient lodging interim zoning district",
      body: "Hotels, motels, hostels, bed and breakfasts, timeshares and commercial short-term rentals need City Council conditional use approval, even where the zoning normally allows them. The pause was adopted May 7, 2026 for one year, and the Council can extend it.",
      sourceUrl: CZO_ART19,
      verified: true,
    });
    rules.push({
      title: "Data center interim zoning district",
      body: "The City Council paused new approvals and occupational licenses for data centers citywide for one year starting January 28, 2026. The exact ordinance number and end date are not confirmed here.",
      sourceUrl: DATA_CENTER,
      verified: false,
    });
  }
  return rules;
}

const DISTRICTS: Record<string, string> = {
  "OS-N": "Neighborhood parks and open space.",
  "OS-G": "Greenways and trails.",
  "OS-R": "Large regional parks and open space.",
  "OS-CBD": "Open space in the downtown business district.",
  "OS-AR": "Armstrong Park.",
  NA: "Protected natural areas such as wetlands.",
  GPD: "Environmentally sensitive land, with flexible, low-impact development.",
  "R-RE": "Rural estates with large lots.",
  "M-MU": "Mixed uses along the working waterfront.",
  "VCR-1": "French Quarter residential, preserving the area's character.",
  "VCR-2": "French Quarter residential, with somewhat higher density than VCR-1.",
  "VCC-1": "French Quarter small-scale shops and services that fit nearby homes.",
  "VCC-2": "French Quarter shops and services, including the main shopping area.",
  VCE: "French Quarter entertainment area, including bars and live music.",
  VCS: "French Quarter riverside area for ground-floor commerce with housing above.",
  VCP: "French Quarter parks and public facilities.",
  "HMR-1": "Historic Marigny, Tremé and Bywater homes, preserving existing character.",
  "HMR-2": "Historic Marigny, Tremé and Bywater homes, with smaller lots allowed.",
  "HMR-3": "Marigny, Tremé and Bywater single- and two-family homes, with some small multi-family buildings.",
  "HMC-1": "Marigny, Tremé and Bywater small-scale shops and services.",
  "HMC-2": "Marigny, Tremé and Bywater busier commercial streets.",
  "HM-MU": "Marigny, Tremé and Bywater mix of light industrial, commercial and residential uses.",
  "HU-RS": "Older neighborhoods, single-family homes.",
  "HU-RD1": "Older neighborhoods, two-family homes on smaller lots.",
  "HU-RD2": "Older neighborhoods, two-family homes mixed with single-family homes.",
  "HU-RM1": "Older neighborhoods, low-density multi-family housing up to three stories.",
  "HU-RM2": "Older neighborhoods, multi-family housing up to four stories.",
  "HU-B1A": "Older neighborhoods, corner stores and small businesses among homes.",
  "HU-B1": "Older neighborhoods, businesses serving nearby residents.",
  "HU-MU": "Older neighborhoods, walkable mix of shops with homes above.",
  "S-RS": "Newer neighborhoods, single-family homes.",
  "S-RD": "Newer neighborhoods, two-family homes and townhouses.",
  "S-RM1": "Newer neighborhoods, multi-family housing up to four stories.",
  "S-RM2": "Newer neighborhoods, suburban multi-family housing up to four stories.",
  "S-B1": "Newer neighborhoods, businesses serving nearby residents.",
  "S-B2": "Newer neighborhoods, walkable business corridors.",
  "S-MU": "Newer neighborhoods, mixed use with shops on the ground floor and homes above.",
  "S-LC": "Lake area general commercial uses.",
  "S-LP": "Lake area neighborhood parks.",
  "S-LM": "Lake area marina and waterfront recreation.",
  "C-1": "General commercial along busy corridors, mixing shops, services and housing.",
  "C-2": "Auto-oriented commercial for large stores and strip centers along major roads.",
  "C-3": "Heavy commercial, auto-oriented, for large shopping centers.",
  "MU-1": "Medium-intensity mixed use, walkable centers with homes and shops.",
  "MU-2": "High-intensity mixed use, walkable centers with homes, offices and shops.",
  EC: "University campuses.",
  MC: "Medical campuses.",
  MS: "Local hospitals and medical services.",
  LS: "Life science research mixed with housing and shops.",
  BIP: "Office and light-industrial parks.",
  LI: "Light industrial: manufacturing, warehousing and wholesale.",
  HI: "Heavy industrial: higher-impact manufacturing and storage.",
  MI: "Maritime industrial: port and shipping operations.",
  "CBD-1": "Downtown core, high-density offices, hotels, housing and entertainment.",
  "CBD-2": "Downtown historic buildings and mixed-use streets.",
  "CBD-3": "Downtown arts and entertainment district around Canal, Basin and Rampart.",
  "CBD-4": "Downtown large venues such as the Superdome and Convention Center.",
  "CBD-5": "Downtown neighborhood, lower-intensity mixed use around Lafayette Square.",
  "CBD-6": "Downtown neighborhood mixed use, including the Warehouse District.",
  "CBD-7": "Downtown bio-science campus.",
};

// Pattern fallbacks for districts not listed above (e.g. the Lake Area S-L* families).
const FALLBACKS: [RegExp, string][] = [
  [/^S-LRS/, "Lake area single-family homes."],
  [/^S-LRD/, "Lake area two-family homes."],
  [/^S-LRM/, "Lake area multi-family housing."],
  [/^S-LB/, "Lake area neighborhood business."],
  [/^CBD/, "Downtown central business district."],
  [/^VC/, "French Quarter district under Vieux Carré Commission review."],
  [/^HM/, "Historic Marigny, Tremé and Bywater district."],
  [/^HU-/, "Older New Orleans neighborhoods."],
  [/^S-/, "Newer New Orleans neighborhoods."],
  [/^OS-/, "Open space."],
];

export function zoningPlainEnglish(code: string | null, _desc: string | null): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase().replace(/-IZ$/, "");
  if (DISTRICTS[c]) return DISTRICTS[c];
  for (const [re, text] of FALLBACKS) if (re.test(c)) return text;
  return null;
}
