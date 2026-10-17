// ABOUTME: Address normalizer shared by ingestion and the Workers: parses messy city address strings
// ABOUTME: into house numbers, suffix, unit, and a canonical street key like "SAINT CLAUDE AVE".

export interface ParsedAddress {
  numbers: number[];
  suffix: string | null;
  street: string;
  unit: string | null;
  notes: string[];
}

const STREET_TYPES: Record<string, string> = {
  STREET: "ST", ST: "ST", STR: "ST",
  AVENUE: "AVE", AVE: "AVE", AV: "AVE", AVN: "AVE",
  BOULEVARD: "BLVD", BLVD: "BLVD",
  DRIVE: "DR", DR: "DR",
  ROAD: "RD", RD: "RD",
  PLACE: "PL", PL: "PL",
  COURT: "CT", CT: "CT",
  LANE: "LN", LN: "LN",
  PARKWAY: "PKWY", PKWY: "PKWY", PRKWY: "PKWY", PKY: "PKWY",
  HIGHWAY: "HWY", HWY: "HWY",
  PLAZA: "PLZ", PLZ: "PLZ",
  TERRACE: "TER", TER: "TER",
  CIRCLE: "CIR", CIR: "CIR",
  SQUARE: "SQ", SQ: "SQ",
  ALLEY: "ALY", ALY: "ALY",
  COVE: "CV", CV: "CV",
  POINT: "PT", PT: "PT",
  TRACE: "TRCE", TRCE: "TRCE",
  EXPRESSWAY: "EXPY", EXPY: "EXPY",
  CROSSING: "XING", XING: "XING",
  WAY: "WAY", WALK: "WALK", ROW: "ROW", LOOP: "LOOP", MALL: "MALL",
};

/** Canonical street-type abbreviations ("ST", "AVE", ...), for callers that compare names without the type. */
export const STREET_TYPE_ABBRS = new Set(Object.values(STREET_TYPES));

const DIRECTIONS: Record<string, string> = { NORTH: "N", SOUTH: "S", EAST: "E", WEST: "W", N: "N", S: "S", E: "E", W: "W" };

const ONES = ["", "FIRST", "SECOND", "THIRD", "FOURTH", "FIFTH", "SIXTH", "SEVENTH", "EIGHTH", "NINTH"];
const TEENS = ["TENTH", "ELEVENTH", "TWELFTH", "THIRTEENTH", "FOURTEENTH", "FIFTEENTH", "SIXTEENTH", "SEVENTEENTH", "EIGHTEENTH", "NINETEENTH"];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];
const TENS_ORDINAL = ["", "", "TWENTIETH", "THIRTIETH", "FORTIETH", "FIFTIETH", "SIXTIETH", "SEVENTIETH", "EIGHTIETH", "NINETIETH"];

function ordinalWord(n: number): string | null {
  if (n < 1 || n > 99) return null;
  if (n < 10) return ONES[n]!;
  if (n < 20) return TEENS[n - 10]!;
  const t = Math.floor(n / 10), o = n % 10;
  return o === 0 ? TENS_ORDINAL[t]! : `${TENS[t]} ${ONES[o]}`;
}

/** Uppercase, strip accents and apostrophes, turn punctuation into spaces, collapse whitespace. */
function clean(input: string): string {
  return input
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/['’`]/g, "")
    .replace(/[.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeStreet(input: string): string {
  const tokens = clean(input).split(" ").filter(Boolean);
  if (tokens.length === 0) return "";

  // "Dr Martin Luther King Jr Blvd": the leading DR is an honorific, not a street type.
  if (tokens[0] === "DR" && tokens[1] === "MARTIN") tokens.shift();

  let prefix: string | null = null;
  if (tokens.length > 1 && DIRECTIONS[tokens[0]!] && !STREET_TYPES[tokens[1]!]) {
    prefix = DIRECTIONS[tokens.shift()!]!;
  }

  let trailingDir: string | null = null;
  if (tokens.length > 2 && DIRECTIONS[tokens[tokens.length - 1]!] && STREET_TYPES[tokens[tokens.length - 2]!]) {
    trailingDir = DIRECTIONS[tokens.pop()!]!;
  }

  let type: string | null = null;
  if (tokens.length > 1 && STREET_TYPES[tokens[tokens.length - 1]!]) {
    type = STREET_TYPES[tokens.pop()!]!;
  }

  const name = tokens.flatMap((tok, i) => {
    if (i === 0 && (tok === "ST" || tok === "STE") && tokens.length > 1) return ["SAINT"];
    if (i === 0 && tok === "GEN") return ["GENERAL"];
    const ord = /^(\d+)(ST|ND|RD|TH)$/.exec(tok);
    if (ord) {
      const word = ordinalWord(Number(ord[1]));
      if (word) return word.split(" ");
    }
    return [tok];
  });

  return [prefix, ...name, type, trailingDir].filter(Boolean).join(" ");
}

const UNIT_WORDS = "APT|APARTMENT|UNIT|STE|SUITE|BLDG|BUILDING|FL|FLOOR|RM|ROOM|LOT|SPACE";
const UNIT_RE = new RegExp(`(?:^|\\s|-)(?:(?:${UNIT_WORDS})\\b\\.?|#)\\s*(.*)$`);
const POSITION_UNIT_RE = /\s(REAR|UPPER|LOWER|FRONT|BACK|SIDE)\s*$/;
const CITY_RE = /^(NEW ORLEANS|NOLA|LA|LOUISIANA|LA \d{5}(-\d{4})?|\d{5}(-\d{4})?|NEW ORLEANS LA( \d{5})?)$/;

interface Head { numbers: number[]; suffix: string | null; rest: string }

/** Parse the leading house number(s) of a segment: plain, range, half, or letter suffix. */
function parseHead(seg: string): Head | null {
  let m = /^(\d+)\s*[-/]\s*(\d+)\s+(.*)$/.exec(seg);
  if (m) {
    const lo = m[1]!, hiRaw = m[2]!;
    const hi = hiRaw.length < lo.length ? lo.slice(0, lo.length - hiRaw.length) + hiRaw : hiRaw;
    return { numbers: [Number(lo), Number(hi)], suffix: null, rest: m[3]! };
  }
  m = /^(\d+)\s+(1\/2)\s+(.*)$/.exec(seg);
  if (m) return { numbers: [Number(m[1])], suffix: "1/2", rest: m[3]! };
  m = /^(\d+)\s*-\s*([A-Z])\s+(.*)$/.exec(seg) ?? /^(\d+)([A-Z])\s+(.*)$/.exec(seg);
  if (m) return { numbers: [Number(m[1])], suffix: m[2]!, rest: m[3]! };
  m = /^(\d+)\s+(.*)$/.exec(seg);
  if (m) return { numbers: [Number(m[1])], suffix: null, rest: m[2]! };
  return null;
}

/** Remove a trailing unit designator; returns the street text and the unit. */
function splitUnit(text: string): { street: string; unit: string | null } {
  const { street, tail } = cutAfterType(text);
  if (tail !== null) return { street, unit: stripUnitWord(tail) };
  const m = UNIT_RE.exec(text);
  if (m) return { street: text.slice(0, m.index).replace(/[\s-]+$/, ""), unit: m[1]!.trim() };
  const p = POSITION_UNIT_RE.exec(text);
  if (p) return { street: text.slice(0, p.index), unit: p[1]! };
  return { street: text, unit: null };
}

const LEADING_UNIT_RE = new RegExp(`^-?\\s*(?:(?:${UNIT_WORDS})\\b|#)\\s*`);
const stripUnitWord = (tail: string) => tail.replace(LEADING_UNIT_RE, "").trim() || tail;

/**
 * Anything after the last street type is unit text: "SAINT CLAUDE AVE A", "CHARTRES ST 2ND FLOOR FRONT".
 * Exceptions: a trailing direction ("SERVICE RD NORTH"), a type that starts the name ("AVENUE A"),
 * and a highway number ("US HWY 90").
 */
function cutAfterType(text: string): { street: string; tail: string | null } {
  const tokens = text.split(" ").filter(Boolean);
  for (let i = tokens.length - 2; i >= 1; i--) {
    const type = STREET_TYPES[tokens[i]!];
    if (!type) continue;
    const tail = tokens.slice(i + 1);
    if (tail.length === 1 && (DIRECTIONS[tail[0]!] || (type === "HWY" && /^\d+$/.test(tail[0]!)))) break;
    if (tail.some((t) => STREET_TYPES[t])) continue;
    return { street: tokens.slice(0, i + 1).join(" "), tail: tail.join(" ") };
  }
  return { street: text, tail: null };
}

export function parseAddress(input: string): ParsedAddress | null {
  if (!input) return null;
  const notes: string[] = [];
  let s = input.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/\[([^\]]*)\]|\{([^}]*)\}/g, (_, a?: string, b?: string) => { notes.push((a ?? b ?? "").trim()); return " "; });
  s = s.toUpperCase().replace(/['’`]/g, "").replace(/\./g, " ").replace(/\s+/g, " ").trim();

  if (/^NEAR\s+/.test(s)) { notes.push("near"); s = s.replace(/^NEAR\s+/, ""); }

  // "011XX GRAVIER ST" (NOPD) and "3100 BLK ST BERNARD" (code enforcement) both mean a hundred-block.
  const block = /^0*(\d+)XX\s+(.*)$/.exec(s) ?? /^(\d+)00\s+BLK\s+(.*)$/.exec(s);
  if (block) {
    const street = normalizeStreet(block[2]!);
    return street ? { numbers: [Number(block[1]) * 100], suffix: null, street, unit: null, notes: [...notes, "block"] } : null;
  }

  if (/\(|\s(AND|&)\s/.test(s)) return null;

  const [first, ...others] = s.split(",").map((x) => x.trim()).filter(Boolean);
  if (!first) return null;
  const head = parseHead(first);
  if (!head) return null;
  const { street: streetText, unit: firstUnit } = splitUnit(head.rest);
  const street = normalizeStreet(streetText);
  if (!/[A-Z]/.test(street)) return null;

  const numbers = [...head.numbers];
  let unit = firstUnit;
  for (const seg of others) {
    if (CITY_RE.test(seg)) continue;
    const unitOnly = splitUnit(` ${seg}`);
    if (unitOnly.unit !== null && unitOnly.street.trim() === "") { unit ??= unitOnly.unit; continue; }
    const h = parseHead(seg);
    if (h && normalizeStreet(splitUnit(h.rest).street) === street) {
      for (const n of h.numbers) if (!numbers.includes(n)) numbers.push(n);
    }
  }

  return { numbers, suffix: head.suffix, street, unit: unit === "" ? null : unit, notes };
}
