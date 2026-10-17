// ABOUTME: Parses One Stop (onestopapp.nola.gov) permit detail pages into a structured object and permit_event rows.
// ABOUTME: Regex/string parsing with no dependencies so it runs in Node and Cloudflare Workers.
import { dropContact } from "./sources/helpers";

export interface OneStopDetail {
  onestopId: number; referenceCode: string | null; permitNum: string | null; type: string | null;
  location: string | null; ownerName: string | null; description: string | null; createdBy: string | null;
  isEmpty: boolean;
  statuses: { name: string; complete: boolean; date: string | null }[];
  fees: { type: string; amount: number | null; paid: boolean | null }[];
  reviews: { division: string; status: string | null; date: string | null; reviewer: string | null }[];
  reviewComments: { division: string; status: string | null; comment: string }[];
  inspections: { type: string; date: string | null; status: string | null }[];
  contractors: { name: string; license: string | null }[];
  details: Record<string, string>;
}

export interface PermitEventRow {
  permit_num: string; seq: number; kind: string; name: string | null; status: string | null;
  event_date: string | null; actor: string | null; detail: string | null; source_id: string;
}

const SOURCE_ID = "onestop:detail";
const MAX_EVENTS = 900;

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeOnce(s: string): string {
  return s.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));/gi, (m, dec, hex, name) => {
    if (dec || hex) {
      const cp = dec ? Number(dec) : parseInt(String(hex), 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : m;
    }
    return NAMED_ENTITIES[String(name).toLowerCase()] ?? m;
  });
}

/** Decodes entities, twice, because the source double-escapes some text (`&amp;#39;`). */
function decode(s: string): string {
  return decodeOnce(decodeOnce(s));
}

/** Cell text: tags removed, entities decoded, contact details dropped, whitespace trimmed. Null when blank. */
function clean(raw: string, keepLines = false): string | null {
  let s = decode(raw.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")).replace(/\r\n?/g, "\n").replace(/ /g, " ");
  s = dropContact(s);
  s = keepLines ? s.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n") : s.replace(/\s+/g, " ");
  s = s.trim();
  return s === "" ? null : s;
}

/** M/D/YYYY (optionally followed by a time) to YYYY-MM-DD; null for anything else, e.g. "Unscheduled". */
function isoDate(s: string | null): string | null {
  const m = s ? /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s) : null;
  if (!m) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

interface Row { cells: string[]; header: boolean }

function rowsOf(html: string): Row[] {
  const rows: Row[] = [];
  for (const tr of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const tds = [...(tr[1] ?? "").matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
    if (tds.length === 0) continue;
    rows.push({ cells: tds.map((t) => t[2] ?? ""), header: tds.every((t) => /class=['"]bold['"]/i.test(t[1] ?? "")) });
  }
  return rows;
}

/** Body rows of each section keyed by its <h5> title; header rows (bold cells) are dropped. */
function sectionRows(html: string): Map<string, string[][]> {
  const out = new Map<string, string[][]>();
  const parts = html.split(/<h5[^>]*>/i);
  for (const part of parts.slice(1)) {
    const end = part.indexOf("</h5>");
    if (end < 0) continue;
    const title = clean(part.slice(0, end));
    if (!title) continue;
    out.set(title, rowsOf(part.slice(end + 5)).filter((r) => !r.header).map((r) => r.cells));
  }
  return out;
}

/** Summary rows are label (bold) / value pairs, so they are keyed by label. */
function summaryFields(html: string): Map<string, string> {
  const out = new Map<string, string>();
  const m = /<h5[^>]*>\s*Application Summary\s*<\/h5>([\s\S]*?)(?=<h5|$)/i.exec(html);
  if (!m) return out;
  for (const r of rowsOf(m[1] ?? "")) {
    const label = clean(r.cells[0] ?? "");
    if (label && r.cells.length >= 2) out.set(label.replace(/:$/, ""), r.cells[1] ?? "");
  }
  return out;
}

const cellText = (cells: string[], i: number, keepLines = false) => clean(cells[i] ?? "", keepLines);

function parseAmount(s: string | null): number | null {
  if (!s) return null;
  const n = Number(s.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function yesNo(s: string | null): boolean | null {
  if (!s) return null;
  if (/^(yes|y|true)$/i.test(s)) return true;
  if (/^(no|n|false)$/i.test(s)) return false;
  return null;
}

export function parseOneStopDetail(rawHtml: string, onestopId: number): OneStopDetail {
  // The crawler can append a second (honeypot) document; only the first one is the permit page.
  const firstEnd = rawHtml.search(/<\/html>/i);
  const page = firstEnd >= 0 ? rawHtml.slice(0, firstEnd) : rawHtml;

  const referenceCode = clean(/Your reference code is[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(page)?.[1] ?? "");

  // The permit number is usually inside an HTML comment, so read it before comments are stripped.
  const permitRaw = clean(/Permit Number:\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i.exec(page)?.[1] ?? "");
  const permitNum = permitRaw && !/^not issued$/i.test(permitRaw) ? permitRaw : null;

  const html = page.replace(/<!--[\s\S]*?-->/g, "");
  const summary = summaryFields(html);
  const field = (label: string, keepLines = false) => clean(summary.get(label) ?? "", keepLines);
  const sections = sectionRows(html);
  const rows = (title: string) => sections.get(title) ?? [];

  const statuses = rows("Status Information").flatMap((c) => {
    const name = cellText(c, 0);
    return name ? [{ name, complete: yesNo(cellText(c, 1)) === true, date: isoDate(cellText(c, 2)) }] : [];
  });

  const fees = rows("Fees").flatMap((c) => {
    const type = cellText(c, 0);
    return type ? [{ type, amount: parseAmount(cellText(c, 1)), paid: yesNo(cellText(c, 2)) }] : [];
  });

  const reviews = rows("Reviews").flatMap((c) => {
    const division = cellText(c, 0);
    if (!division) return [];
    const st = cellText(c, 1);
    const m = st ? /^(.*?)\s*\(([^)]*)\)\s*$/.exec(st) : null;
    return [{
      division,
      status: (m ? (m[1] ?? "").trim() : st) || null,
      date: isoDate(m ? (m[2] ?? "") : st),
      reviewer: cellText(c, 2),
    }];
  });

  const reviewComments = rows("Review Comments").flatMap((c) => {
    const division = cellText(c, 0);
    const comment = cellText(c, 2, true);
    return division || comment ? [{ division: division ?? "", status: cellText(c, 1), comment: comment ?? "" }] : [];
  });

  const inspections = rows("Inspections").flatMap((c) => {
    const type = cellText(c, 0);
    return type ? [{ type, date: isoDate(cellText(c, 1)), status: cellText(c, 2) }] : [];
  });

  const contractors = rows("Contractors").flatMap((c) => {
    const name = cellText(c, 0);
    return name ? [{ name, license: cellText(c, 1) }] : [];
  });

  const details: Record<string, string> = {};
  for (const c of rows("Details")) {
    const name = cellText(c, 0);
    const value = cellText(c, 1);
    if (name && value != null && !(name in details)) details[name] = value; // repeated names (tents) keep the first
  }

  const detail: OneStopDetail = {
    onestopId, referenceCode, permitNum,
    type: field("Type"), location: field("Location"), ownerName: field("Property Owner"),
    description: field("Description", true), createdBy: field("Created By"),
    isEmpty: false,
    statuses, fees, reviews, reviewComments, inspections, contractors, details,
  };
  detail.isEmpty =
    !referenceCode && !permitNum && !detail.type && !detail.location && !detail.ownerName && !detail.description &&
    !detail.createdBy && [statuses, fees, reviews, reviewComments, inspections, contractors].every((a) => a.length === 0) &&
    Object.keys(details).length === 0;
  return detail;
}

/** permit_event rows (status, fee, review, inspection in page order); none for permits that have no number yet. */
export function detailToEvents(d: OneStopDetail): PermitEventRow[] {
  const permitNum = d.permitNum;
  if (!permitNum) return [];
  const rows: Omit<PermitEventRow, "permit_num" | "seq" | "source_id">[] = [
    ...d.statuses.map((s) => ({ kind: "status", name: s.name, status: s.complete ? "Complete" : "Pending", event_date: s.date, actor: null, detail: null })),
    ...d.fees.map((f) => ({
      kind: "fee", name: f.type, status: f.paid == null ? null : f.paid ? "Paid" : "Unpaid",
      event_date: null, actor: null, detail: f.amount == null ? null : String(f.amount),
    })),
    ...d.reviews.map((r) => ({ kind: "review", name: r.division, status: r.status, event_date: r.date, actor: r.division, detail: null })),
    ...d.inspections.map((i) => ({ kind: "inspection", name: i.type, status: i.status, event_date: i.date, actor: null, detail: null })),
  ];
  return rows.slice(0, MAX_EVENTS).map((r, seq) => ({ permit_num: permitNum, seq, ...r, source_id: SOURCE_ID }));
}
