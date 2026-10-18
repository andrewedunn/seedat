// ABOUTME: Renders the property page: tiled address, plain-English summary, key facts, one chronological ledger of
// ABOUTME: permits / code cases / One Stop reviews / STR licenses, plus rules, block activity, units and sources.
import { rulesForParcel, zoningPlainEnglish } from "@seedat/core/src/rules";
import { isPermitOpen } from "@seedat/core/src/status";
import { summarizeProperty, titleCase } from "@seedat/core/src/summary";
import type { CodeCase, OneStopRecord, Permit, Property, StrLicense } from "@seedat/d1/src/property";
import { type Env, Html, fmtDate, fmtMoney, html, page, raw, slug, tiles } from "./html";

interface Entry { date: string | null; kind: string; kindClass: string; title: string; status: string | null; open: boolean; body: Html; sortKey: string }

const ONESTOP = (ref: string) => `https://onestopapp.nola.gov/Redirect.aspx?SearchString=${encodeURIComponent(ref)}`;

/** Human labels for One Stop record types that are not ordinary building permits. */
function onestopKind(type: string | null): { kind: string; cls: string } {
  const t = type ?? "";
  if (/^HDLC/i.test(t)) return { kind: "HDLC review", cls: "k-review" };
  if (/^VCC/i.test(t)) return { kind: "VCC review", cls: "k-review" };
  if (/special event/i.test(t)) return { kind: "Special event", cls: "k-event" };
  if (/film/i.test(t)) return { kind: "Film permit", cls: "k-event" };
  return { kind: "City record", cls: "k-record" };
}

function permitEntry(p: Permit): Entry {
  const open = isPermitOpen(p);
  const contractor = (() => { try { return (JSON.parse(p.contractor ?? "[]") as { name: string }[]).map((c) => c.name).join(", "); } catch { return ""; } })();
  const facts: [string, string][] = [
    ["Permit", p.permit_num], ["Type", p.permit_type_desc ?? p.permit_type ?? ""], ["Work", p.work_class ?? ""],
    ["Estimated cost (applicant’s figure)", fmtMoney(p.est_cost)], ["Fees", fmtMoney(p.fees_total)], ["Contractor", contractor],
    ["Days from application to issue", p.days_to_issue === null ? "" : String(p.days_to_issue)],
    ["Expires", fmtDate(p.expires_date)],
  ];
  const events = p.events.filter((e) => e.event_date || e.status);
  const body = html`
    ${p.description ? html`<p class="desc">${p.description}</p>` : ""}
    <dl class="facts">${facts.filter(([, v]) => v).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
    ${events.length ? html`<ol class="events">${events.map((e) => html`<li><time>${fmtDate(e.event_date)}</time> <span>${e.name}</span>${e.status && e.status !== "Unscheduled" ? html` <em>${e.status}</em>` : ""}</li>`)}</ol>` : ""}
    ${p.onestop_ref ? html`<p class="src"><a href="${ONESTOP(p.onestop_ref)}" rel="noopener">See this permit on One Stop</a></p>` : ""}
    ${p.match_type !== "exact" && p.match_type !== "source_geopin" ? html`<p class="match">Placed here by ${matchLabel(p.match_type)} from “${p.address_raw}”.</p>` : ""}`;
  const title = p.permit_type_desc ?? p.permit_type ?? "Permit";
  return { date: p.applied_date ?? p.issued_date, kind: "Permit", kindClass: "k-permit", title, status: p.status_mapped ?? p.status, open, body, sortKey: p.permit_num };
}

/** The city's code-enforcement pipeline, as published in the case `stage` column. */
const CASE_STAGES = ["1 - Inspection", "2 - Title Research", "3 - Hearing", "4 - Judgment", "5 - In Compliance", "6 - Case Closed"];

function caseEntry(c: CodeCase): Entry {
  const stageIdx = CASE_STAGES.findIndex((s) => c.stage?.startsWith(s.slice(0, 2)));
  const stages = c.is_open && stageIdx >= 0
    ? html`<ol class="stages" aria-label="Case stage">${CASE_STAGES.slice(0, 5).map((s, i) => html`<li class="${i < stageIdx ? "done" : i === stageIdx ? "now" : ""}"${i === stageIdx ? raw(' aria-current="step"') : ""}>${s.slice(4)}</li>`)}</ol>` : "";
  const body = html`
    ${c.key_status ? html`<p class="desc">${c.key_status}</p>` : ""}
    ${stages}
    ${c.events.length ? html`<ol class="events">${c.events.map((e) => html`<li><time>${fmtDate(e.event_date)}</time> <span>${titleCase(e.kind)}${e.type ? `: ${e.type}` : ""}</span>${e.result ? html` <em>${e.result}</em>` : ""}</li>`)}</ol>` : ""}
    ${c.last_permit_num ? html`<p class="src">The city links this case to permit ${c.last_permit_num}.</p>` : ""}`;
  return { date: c.filed_date, kind: "Code enforcement", kindClass: "k-code", title: `Case ${c.case_no ?? c.case_id}`, status: c.is_open ? (c.stage?.replace(/^\S+ - /, "") ?? "Open") : "Closed", open: !!c.is_open, body, sortKey: String(c.case_id) };
}

function onestopEntry(r: OneStopRecord): Entry {
  const { kind, cls } = onestopKind(r.record_type);
  let d: { statuses?: { name: string; complete: boolean; date: string | null }[]; reviews?: { division: string; status: string | null; date: string | null }[]; inspections?: { type: string; date: string | null; status: string | null }[] } = {};
  try { d = JSON.parse(r.detail_json); } catch { /* keep empty */ }
  const steps = [
    ...(d.statuses ?? []).map((s) => ({ date: s.date, label: s.name, note: s.complete ? "" : "pending" })),
    ...(d.reviews ?? []).map((s) => ({ date: s.date, label: `${s.division} review`, note: s.status ?? "" })),
  ].sort((a, b) => (a.date ?? "9").localeCompare(b.date ?? "9"));
  const body = html`
    ${r.description ? html`<p class="desc">${r.description}</p>` : ""}
    ${steps.length ? html`<ol class="events">${steps.map((s) => html`<li><time>${fmtDate(s.date)}</time> <span>${s.label}</span>${s.note ? html` <em>${s.note}</em>` : ""}</li>`)}</ol>` : ""}
    ${r.reference_code ? html`<p class="src"><a href="${ONESTOP(r.reference_code)}" rel="noopener">See this record on One Stop</a> · checked ${fmtDate(r.fetched_at)}</p>` : ""}`;
  const open = r.current_status !== null && !/closed|complete|issued|approved|withdrawn|denied/i.test(r.current_status);
  return { date: r.submitted_date, kind, kindClass: cls, title: r.record_type ?? "One Stop record", status: r.current_status, open, body, sortKey: String(r.onestop_id) };
}

function strEntry(s: StrLicense): Entry {
  const body = html`<dl class="facts">
    ${[["License", s.license_number], ["Type", s.license_type], ["Operator", s.operator_name], ["Issued", fmtDate(s.issued_date)], ["Expires", fmtDate(s.expiration_date)]]
      .filter(([, v]) => v).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>`;
  return {
    date: s.issued_date ?? s.applied_date, kind: "Short-term rental", kindClass: "k-str",
    title: `${s.license_type ?? "Short-term rental"} license${s.is_active ? "" : " application"}`,
    status: s.is_active ? "Active" : s.status, open: !!s.is_active, body, sortKey: s.str_id,
  };
}

function matchLabel(t: string): string {
  return ({
    base_address: "the building address", range_member: "an address range", alias: "a known alternate street name",
    parcel_situs: "the parcel’s own address", fuzzy_street: "a close spelling of the street", tax_bill: "its tax bill number",
    nearest_point: "its map location",
  } as Record<string, string>)[t] ?? t.replace(/_/g, " ");
}

function ledger(p: Property): Entry[] {
  const permitNums = new Set(p.permits.map((x) => x.permit_num));
  return [
    ...p.permits.map(permitEntry),
    ...p.codeCases.map(caseEntry),
    ...p.onestop.filter((r) => !r.permit_num || !permitNums.has(r.permit_num)).map(onestopEntry),
    ...p.strs.map(strEntry),
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.sortKey.localeCompare(b.sortKey));
}

function sourcesUsed(p: Property) {
  const ids = ["socrata:72f9-bi28", "socrata:rcm3-fn58", "socrata:aib5-en5t", "socrata:u6yx-v2tw", "socrata:en36-xvxg", "socrata:2jgv-pqrq", "socrata:es9j-6y5d"];
  return p.freshness.filter((f) => ids.includes(f.source_id));
}

export function renderProperty(env: Env, p: Property, url: URL): Response {
  const a = p.parcel;
  const street = p.addresses.find((x) => !x.unit_id)?.full_address ?? a.situs ?? `Parcel ${a.geopin}`;
  const s = p.summary;
  const zoningPlain = zoningPlainEnglish(a.zoning, a.zoning_desc);
  const vcc = /^VC/i.test(a.zoning ?? "") || /vieux carr/i.test(a.local_historic_district ?? "");
  const summary = summarizeProperty({
    address: street, neighborhood: a.neighborhood, zoning: a.zoning, zoningPlain,
    historicDistrict: a.local_historic_district, hdlcControl: a.hdlc_control, vcc, isLandmark: !!a.is_landmark,
    permitsTotal: p.totals.permits,
    permitsOpen: p.totals.permits > p.permits.length ? (s?.permits_open ?? p.permits.filter(isPermitOpen).length) : p.permits.filter(isPermitOpen).length,
    lastPermitType: p.permits[0]?.permit_type_desc ?? p.permits[0]?.permit_type ?? null, lastPermitDate: p.permits[0]?.applied_date ?? null,
    demolitionDate: s?.demolition_permit_date ?? null,
    codeCasesOpen: p.totals.code_cases_open, codeCasesTotal: p.totals.code_cases, lastCodeCaseDate: p.codeCases[0]?.filed_date ?? null,
    strActiveType: p.strs.find((x) => x.is_active)?.license_type ?? null,
    block311: p.block.requests12m.reduce((n, r) => n + r.n, 0), blockPolice: p.block.police12m.reduce((n, r) => n + r.n, 0),
    today: new Date().toISOString().slice(0, 10),
  });
  const overlays: string[] = (() => { try { return JSON.parse(a.overlays ?? "[]"); } catch { return []; } })();
  const rules = rulesForParcel({
    zoning: a.zoning, zoning_desc: a.zoning_desc, overlays, local_historic_district: a.local_historic_district,
    hdlc_control: a.hdlc_control, nr_district: a.nr_district, is_landmark: !!a.is_landmark, hdlc_solar_review: !!a.hdlc_solar_review,
  });
  const entries = ledger(p);
  const openCount = entries.filter((e) => e.open).length;
  const keyFacts: [string, string | null][] = [
    ["Zoning", a.zoning], ["Historic district", a.local_historic_district ? `${a.local_historic_district} (${a.hdlc_control ?? ""} control)` : "None"],
    ["National Register", a.nr_district], ["Council district", a.council_district], ["Ward", a.ward],
    ["Lot size", a.acres ? `${Math.round(a.acres * 43560).toLocaleString("en-US")} sq ft` : null], ["Parcel", String(a.geopin)],
  ];
  const units = p.addresses.filter((x) => x.unit_id);
  const capped = [
    p.totals.permits > p.permits.length ? `${p.permits.length} of ${p.totals.permits.toLocaleString("en-US")} permits` : null,
    p.totals.code_cases > p.codeCases.length ? `${p.codeCases.length} of ${p.totals.code_cases.toLocaleString("en-US")} code cases` : null,
    p.totals.strs > p.strs.length ? `${p.strs.length} of ${p.totals.strs.toLocaleString("en-US")} rental licenses and applications` : null,
  ].filter((x): x is string => x !== null);
  const total311 = p.block.requests12m.reduce((n, r) => n + r.n, 0);
  const totalPolice = p.block.police12m.reduce((n, r) => n + r.n, 0);
  const maxBar = Math.max(1, ...p.block.requests12m.map((r) => r.n), ...p.block.police12m.map((r) => r.n));

  const body = html`
<section class="address-band">
  <div class="band-inner">
    <p class="eyebrow">${a.neighborhood ? titleCase(a.neighborhood) : "New Orleans"}</p>
    <h1>${tiles(street)}</h1>
    <p class="summary">${summary}</p>
    <dl class="keyfacts">${keyFacts.filter(([, v]) => v).map(([k, v]) => html`<div><dt>${k}</dt><dd>${v}</dd></div>`)}</dl>
  </div>
</section>
<div class="layout">
  <section class="ledger" aria-labelledby="ledger-h">
    <div class="ledger-head">
      <h2 id="ledger-h">Everything on record here</h2>
      <p>${entries.length} records, newest first${openCount ? html` · <strong class="open-count">${openCount} open</strong>` : ""}</p>
      ${capped.length ? html`<p class="note">Showing the latest ${capped.join(" and the latest ")}.</p>` : ""}
    </div>
    ${entries.length === 0 ? html`<p class="empty">The city has no permits, code cases, reviews or rental licenses on record for this parcel.</p>` : ""}
    <ol class="entries">${entries.map((e) => html`
      <li class="entry ${e.kindClass}${e.open ? " is-open" : ""}">
        <details>
          <summary>
            <time>${fmtDate(e.date) || "No date"}</time>
            <span class="kind">${e.kind}</span>
            <span class="title">${e.title}</span>
            ${e.status ? html`<span class="status">${e.status}</span>` : ""}
          </summary>
          <div class="entry-body">${e.body}</div>
        </details>
      </li>`)}</ol>
  </section>
  <aside class="side">
    ${rules.length ? html`<section class="card rules"><h2>Before you build or change anything</h2>
      ${rules.map((r) => html`<div class="rule"><h3>${r.title}</h3><p>${r.body}</p><p class="src"><a href="${r.sourceUrl}" rel="noopener">Source</a>${r.verified ? "" : " · not yet verified"}</p></div>`)}</section>` : ""}
    <section class="card block"><h2>This block, past 12 months</h2>
      <p class="note">Counted for the ${p.block.block_id ?? "surrounding"} block, never for a single address.</p>
      ${total311 ? html`<h3>${total311} requests to 311</h3><ul class="bars">${p.block.requests12m.slice(0, 6).map((r) => html`<li><span>${r.request_type}</span><b style="--w:${(100 * r.n / maxBar).toFixed(0)}%">${r.n}</b></li>`)}</ul>` : html`<p>No 311 requests on this block.</p>`}
      ${totalPolice ? html`<h3>${totalPolice} calls to police</h3><ul class="bars">${p.block.police12m.slice(0, 6).map((r) => html`<li><span>${titleCase(r.category)}</span><b style="--w:${(100 * r.n / maxBar).toFixed(0)}%">${r.n}</b></li>`)}</ul>
        <p class="note">NOPD calls for service are preliminary and block-level by design. Source: Orleans Parish Communications District.</p>` : html`<p>No police calls recorded on this block.</p>`}
    </section>
    ${p.totals.units ? html`<section class="card"><h2>${p.totals.units} units at this address</h2><p class="units">${units.slice(0, 40).map((u) => html`<span>${u.unit_id}</span>`)}${p.totals.units > 40 ? html`<span>and ${p.totals.units - 40} more</span>` : ""}</p></section>` : ""}
    <section class="card"><h2>Where this comes from</h2>
      <ul class="fresh">${sourcesUsed(p).map((f) => html`<li><span>${f.name}</span><time>${fmtDate(f.last_success_at)}</time></li>`)}</ul>
      <p class="note"><a href="/map#${a.geopin}">See this parcel on the map</a> · <a href="/about">How records are matched to parcels</a></p>
    </section>
  </aside>
</div>`;
  return page(env, {
    title: `${street}, New Orleans — See Dat`,
    description: summary.slice(0, 300),
    canonical: `${url.origin}/p/${a.geopin}/${slug(street)}`,
    body,
  });
}

