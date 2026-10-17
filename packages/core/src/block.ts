// ABOUTME: Turns an address into its hundred-block id ("1100 GRAVIER ST"), the only location grain 311 and police data may carry.
// ABOUTME: Intersections and addresses without a house number have no block and return null.
import { parseAddress, type ParsedAddress } from "./normalize";

export function blockIdFor(parsed: ParsedAddress | null): string | null {
  const n = parsed?.numbers[0];
  if (!parsed || n === undefined || !parsed.street) return null;
  return `${Math.floor(n / 100) * 100} ${parsed.street}`;
}

/** NOPD writes some blocks as "064XX Blk Pontchartrain Blvd"; the parser only knows the "XX" form without "Blk". */
export function blockIdForText(address: string | null | undefined): string | null {
  if (!address) return null;
  return blockIdFor(parseAddress(address.replace(/^(\s*\d+XX)\s+BLK\.?\s+/i, "$1 ")));
}
