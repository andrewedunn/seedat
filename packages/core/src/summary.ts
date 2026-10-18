// ABOUTME: Writes the plain-English summary at the top of a property page from structured facts only.
// ABOUTME: Every sentence maps to a database field; nothing is inferred or invented.

export interface SummaryFacts {
  address: string; neighborhood: string | null; zoning: string | null; zoningPlain: string | null;
  historicDistrict: string | null; hdlcControl: "Full" | "Partial" | null; vcc: boolean; isLandmark: boolean;
  permitsTotal: number; permitsOpen: number; lastPermitType: string | null; lastPermitDate: string | null; demolitionDate: string | null;
  codeCasesOpen: number; codeCasesTotal: number; lastCodeCaseDate: string | null; strActiveType: string | null;
  block311: number; blockPolice: number; today: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthYear(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})/.exec(iso) : null;
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : null;
}

/** "BYWATER" -> "Bywater", "ST. ROCH" -> "St. Roch", "McDONOGH" -> "McDonogh". */
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|[\s\-/.(])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()).replace(/\bMcd/g, "McD");
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "HDLC COA" stays upper case, "Plumbing Permit" becomes "plumbing"; a trailing "permit" is dropped. */
function permitNoun(type: string): string {
  return type.replace(/\s+permit$/i, "").split(" ").map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w.toLowerCase())).join(" ");
}

/** Article by sound: acronyms are read letter by letter ("an HDLC", "a VCC"), words by their first letter. */
function article(phrase: string): "a" | "an" {
  const first = phrase.split(" ")[0] ?? "";
  if (/^[A-Z]{2,}$/.test(first)) return /^[AEFHILMNORSX]/.test(first) ? "an" : "a";
  return /^[aeiou]/i.test(first) ? "an" : "a";
}

export function summarizeProperty(f: SummaryFacts): string {
  const out: string[] = [];

  const where = f.neighborhood ? ` is in ${titleCase(f.neighborhood)}` : "";
  const plain = f.zoningPlain?.replace(/\.\s*$/, "");
  const zoned = f.zoning ? `${where ? "," : ""} zoned ${f.zoning}${plain ? ` (${plain})` : ""}` : "";
  out.push(where || zoned ? `${f.address}${where}${zoned}.` : `${f.address}.`);

  if (f.vcc) out.push("It is in the French Quarter, where the Vieux Carré Commission reviews exterior work before it starts.");
  else if (f.historicDistrict && f.hdlcControl === "Full") out.push(`It is in the ${f.historicDistrict} historic district under full HDLC control, so most exterior changes need approval first.`);
  else if (f.historicDistrict && f.hdlcControl === "Partial") out.push(`It is in the ${f.historicDistrict} historic district under partial HDLC control, where demolition needs HDLC review.`);
  if (f.isLandmark) out.push("The building is a designated landmark.");

  if (f.permitsTotal === 0) out.push("The city has no permits on record for this address.");
  else {
    const recent = f.lastPermitType && f.lastPermitDate
      ? `; the most recent, ${article(permitNoun(f.lastPermitType))} ${permitNoun(f.lastPermitType)} permit, was filed in ${monthYear(f.lastPermitDate)}`
      : "";
    out.push(`The city has ${plural(f.permitsTotal, "permit", "permits")} on record here${recent}.`);
    if (f.permitsOpen > 0) out.push(`${f.permitsOpen} ${f.permitsOpen === 1 ? "is" : "are"} still open.`);
  }
  if (f.demolitionDate) out.push(`A demolition permit was filed in ${monthYear(f.demolitionDate)}.`);

  if (f.codeCasesOpen > 0) out.push(`There ${f.codeCasesOpen === 1 ? "is" : "are"} ${plural(f.codeCasesOpen, "open code enforcement case", "open code enforcement cases")}.`);
  else if (f.codeCasesTotal > 0) {
    const when = monthYear(f.lastCodeCaseDate);
    out.push(`There ${f.codeCasesTotal === 1 ? "was" : "were"} ${plural(f.codeCasesTotal, "past code enforcement case", "past code enforcement cases")}${when ? `, the latest in ${when}` : ""}, all closed.`);
  }

  // The city's license-type names carry their own capitalization ("Lodging Exempt from STR Regulation"); keep them as-is.
  if (f.strActiveType) out.push(`It has an active short-term rental license (${f.strActiveType}).`);

  if (f.block311 > 0 || f.blockPolice > 0) {
    out.push(`On this block in the past year: ${plural(f.block311, "request", "requests")} to 311 and ${plural(f.blockPolice, "call", "calls")} to police.`);
  }
  return out.join(" ");
}
