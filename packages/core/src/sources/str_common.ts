// ABOUTME: Shared pieces of the three short-term-rental adapters: location, operator name scrubbing, and the common row builder.
// ABOUTME: Phone and email columns are never read; names are also run through dropContact in case a number was typed into one.
import { blockIdForText } from "../block";
import { statePlaneToLatLon } from "../projection";
import { cleanDate, dropContact, pointFrom, text } from "./helpers";
import type { RawRow } from "./types";

export function strPoint(raw: RawRow): { lat: number; lon: number } | null {
  const loc = (typeof raw.location === "object" && raw.location !== null ? raw.location : {}) as { latitude?: unknown; longitude?: unknown; coordinates?: unknown };
  const [lonC, latC] = Array.isArray(loc.coordinates) ? (loc.coordinates as unknown[]) : [];
  return (
    pointFrom(raw.latitude, raw.longitude) ??
    pointFrom(loc.latitude, loc.longitude) ??
    pointFrom(latC, lonC) ??
    statePlaneToLatLon(text(raw.x), text(raw.y))
  );
}

export function operatorName(v: unknown): string | null {
  const s = text(v);
  return s === null ? null : dropContact(s) || null;
}

export function strBase(raw: RawRow) {
  const p = strPoint(raw);
  const address = text(raw.address);
  return {
    address_raw: address,
    block_id: blockIdForText(address),
    applied_date: cleanDate(raw.application_date),
    issued_date: cleanDate(raw.issue_date),
    expiration_date: cleanDate(raw.expiration_date),
    lat: p?.lat ?? null,
    lon: p?.lon ?? null,
  };
}

export function strMatchInput(raw: RawRow) {
  const p = strPoint(raw);
  return { address: text(raw.address), lat: p?.lat ?? null, lon: p?.lon ?? null };
}
