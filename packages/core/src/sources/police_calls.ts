// ABOUTME: Adapters for NOPD calls for service, one dataset per year: each call becomes a (block, month, category) tuple to be counted.
// ABOUTME: Calls are never stored individually or tied to a parcel; the category groups the call's initial type text into nine buckets.
import { blockIdForText } from "../block";
import { cleanDate, socrataUrl, text } from "./helpers";
import type { PoliceCallSource, PoliceCategory } from "./types";

/** Dataset ids by calendar year; a new id appears each January (see SOURCES.md). 2019's set also holds early 2020, which is why month comes from the call, not the year. */
const YEAR_IDS: Record<number, string> = {
  2026: "es9j-6y5d", 2025: "4xwx-sfte", 2024: "2zcj-b6ts", 2023: "pc5d-tvaw", 2022: "nci8-thrr", 2021: "3pha-hum9",
  2020: "hp7u-i9hf", 2019: "qf6q-pp4b", 2018: "9san-ivhk", 2017: "bqmt-f3jk", 2016: "wgrp-d3ma", 2015: "w68y-xmk6",
  2014: "jsyu-nz5r", 2013: "5fn8-vtui", 2012: "rv3g-ypg7", 2011: "28ec-c8d6",
};

/**
 * Category rules, first match wins, applied to the upper-cased initial type text.
 * Order matters: domestic before violent ("BATTERY DOMESTIC"), property before suspicious ("AUTO THEFT"),
 * suspicious before traffic ("SUSPICIOUS VEHICLE"), and traffic before proactive ("TRAFFIC STOP").
 * Anything unmatched (alarms, tows, fire, complaints, ...) is 'other'.
 */
const RULES: [PoliceCategory, RegExp][] = [
  ["domestic", /DOMESTIC/],
  ["violent", /SHOOT|SHOTS? FIRED|GUNSHOT|STAB|HOMICIDE|MURDER|ROBBERY|BATTERY|ASSAULT|RAPE|SEX|KIDNAP|ABDUCT|AGGRAV|CARJACK|FIREARM|WEAPON|ARMED|CUTTING/],
  ["property", /BURGLAR|THEFT|LARCENY|SHOPLIFT|STOLEN|VANDAL|DAMAGE|TRESPASS|BREAK-?IN|ARSON|FORGER|FRAUD|UNAUTHORIZED USE|MISCHIEF|PROPERTY/],
  ["suspicious", /SUSPICIOUS|PROWLER|LOITER|PEEPING|PEEPER|WANTED|SUSPECT/],
  ["disturbance", /DISTURB|NOISE|FIREWORK|FIGHT|DRUNK|INTOXICAT|LOUD|MUSIC|DISORDER|HARASS|THREAT|NUISANCE|CROWD|PANHANDL|PROSTITUT|SOLICIT/],
  ["traffic", /TRAFFIC|HIT (AND|&) RUN|ACCIDENT|CRASH|\bDWI\b|\bDUI\b|PARKING|ABANDONED VEH|RECKLESS|SPEEDING|MOTORIST/],
  ["welfare", /MISSING|MENTAL|MEDICAL|AMBULANCE|WELFARE|\bSICK\b|INJUR|OVERDOSE|SUICID|\bEMS\b|ELDERLY|LOST/],
  ["proactive", /AREA CHECK|PATROL|DIRECTED|PREMISE CHECK|BUSINESS CHECK|SECURITY CHECK|SPECIAL ASSIGNMENT/],
];

export function policeCategory(typeText: string): PoliceCategory {
  const t = typeText.toUpperCase();
  return RULES.find(([, re]) => re.test(t))?.[0] ?? "other";
}

function sourceFor(year: number, id: string): PoliceCallSource {
  return {
    sourceId: `socrata:${id}`,
    name: `Calls for Service ${year}`,
    url: socrataUrl(id),
    license: "NOPD terms (non-commercial, block-level)",
    year,
    table: "police_call_month",
    map(raw) {
      const block_id = blockIdForText(text(raw.block_address));
      const month = cleanDate(raw.timecreate)?.slice(0, 7);
      if (!block_id || !month) return null;
      // Older datasets have only `typetext`; newer ones also record the call's type when first created.
      const category = policeCategory(text(raw.initialtypetext) ?? text(raw.typetext) ?? "");
      return { block_id, month, category };
    },
  };
}

export const policeSources: PoliceCallSource[] = Object.entries(YEAR_IDS).map(([y, id]) => sourceFor(Number(y), id));
