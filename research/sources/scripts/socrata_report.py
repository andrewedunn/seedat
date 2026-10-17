# ABOUTME: Builds per-dataset markdown sections and the summary table from probe_summary.json and *.meta.json.
# ABOUTME: Output goes to samples/socrata/_sections.md (pasted into socrata.md) and updates socrata_catalog.csv row counts.
import json, os, csv, datetime
B = os.path.join(os.path.dirname(__file__), '..')
S = os.path.join(B, 'samples/socrata')
P = json.load(open(f'{S}/probe_summary.json'))
TODAY = datetime.date(2026, 10, 17)
GROUPS = [
 ('Permits', ['rcm3-fn58','72f9-bi28','aib5-en5t','nbcf-m6c2','fja2-5dmw','f7tt-z5vu','rw6e-a9x3','fdhh-psg3','aj8a-ghih','68qb-xc34']),
 ('Code enforcement, hearings, adjudication', ['u6yx-v2tw','8pqz-ftzc','uh5a-f7uw','3ehi-je3s','44ct-56tr','mrcm-dtu5','w6gf-dnv6','c8uq-kxp3','xhih-vxs6','xv8z-gn8b','a2w6-xuk2','wy29-i338','uzyk-jrck','f5zm-xkyr','6ha4-bwyc','d4d6-yab5','c3as-66tn','gjzc-adg8','d2is-2r79','grqp-bvwk']),
 ('Demolitions', ['e3wd-h7q2','fcuq-eeca']),
 ('311', ['2jgv-pqrq','ezfk-aiyx','3dnv-gjst','3iz8-nghx','i57e-74kx']),
 ('Calls for service and police reports', ['es9j-6y5d','4xwx-sfte','2zcj-b6ts','pc5d-tvaw','nci8-thrr','3pha-hum9','hp7u-i9hf','qf6q-pp4b','9san-ivhk','bqmt-f3jk','wgrp-d3ma','w68y-xmk6','jsyu-nz5r','5fn8-vtui','rv3g-ypg7','28ec-c8d6','em4n-zidu','agqi-9adb','c5iy-ew8n']),
 ('Short-term rentals and lodging', ['ufdg-ajws','2ei9-wqw2','en36-xvxg','rbhq-zbz9','ns2v-hzec']),
 ('Business licenses', ['iqay-p646','hjcd-grvu','abc4-h3u3','c77v-v89q','tc3j-b7gd','xw7z-p5m2','yc4x-fza2','xy7w-r8a6','sbc5-uppx']),
 ('Parcels, addresses, property, sales', ['v9q5-fz7t','pzqp-4ri7','m5br-772y','hfvu-md72','cym7-cw5z','prh5-qsuf','hpm5-48nj','5ktx-e9wc','d52w-8nva','9a4m-i64z','bsqt-btyi','aned-jbk9']),
 ('Zoning, planning, historic', ['bizp-xi7c','kb74-hpue','ecst-qwxv','xxb5-5azv','hea7-kccz','25e8-s5xx','jcvy-gbgr']),
 ('Infrastructure (SWB and DPW)', ['bsnu-de3a','u5mk-y9z4','2zer-6wpb','se4p-ierc','fdkj-rjrv']),
]
NOTES = json.load(open(os.path.join(os.path.dirname(__file__), 'socrata_notes.json')))
def cnt(v):
    c = v.get('count')
    return int(c[0]['count']) if isinstance(c, list) and c and 'count' in c[0] else None
def rng(v):
    out = []
    for f, x in (v.get('dates') or {}).items():
        if isinstance(x, dict) and 'mn' in x: out.append(f"`{f}` {x['mn'][:10]} to {x['mx'][:10]}")
    return '; '.join(out) or 'n/a (no date-typed columns, or text-typed timestamps)'
def status(v):
    d = datetime.date.fromisoformat(v['rowsUpdatedAt'][:10]) if v.get('rowsUpdatedAt') else None
    if not d: return 'UNKNOWN', None
    age = (TODAY - d).days
    return ('STALE' if age > 90 else 'LIVE'), age
rows, sections, stale = [], [], []
for g, ids in GROUPS:
    sections.append(f'\n## {g}\n')
    for i in ids:
        v = P.get(i)
        if not v or '_error' in v: continue
        m = json.load(open(f'{S}/{i}.meta.json'))
        st, age = status(v); n = cnt(v)
        lic = (m.get('license') or {}).get('name') if isinstance(m.get('license'), dict) else m.get('license')
        note = NOTES.get(i, {})
        rows.append((i, v['name'], g, n, v['rowsUpdatedAt'][:10], age, st, note.get('cadence', ''), note.get('geo', '')))
        if st == 'STALE': stale.append((i, v['name'], v['rowsUpdatedAt'][:10], age, n, note.get('why', '')))
        upd = v.get('updated_at_max'); upd = upd[0] if isinstance(upd, list) and upd else {}
        sec = [f"### {v['name']} (`{i}`) [{st}]",
               f"- URL: https://data.nola.gov/resource/{i}.json (type: {v.get('type')}/{v.get('assetType')}; {v['ncols']} columns)",
               f"- Rows: {n if n is not None else 'n/a'}; last data refresh (rowsUpdatedAt): {v['rowsUpdatedAt']} UTC ({age} days ago); max :updated_at: {str(upd.get('u',''))[:19] or 'n/a'}",
               f"- Date coverage: {rng(v)}",
               f"- License/attribution (metadata): {lic or 'none set'} / {m.get('attribution') or 'none'}",
               f"- Cadence: {note.get('cadence','see summary')}",
               f"- Location/address format: {note.get('geo','see fields')}",
               f"- Join keys: {note.get('keys','n/a')}",
               f"- Notes: {note.get('note','')}",
               f"- Fields: " + ', '.join(f"{c['f']}:{c['t']}" for c in v['cols'] if c['t'] not in ('meta_data',)),
               f"- Sample: `samples/socrata/{i}.sample.json`, metadata: `samples/socrata/{i}.meta.json`\n"]
        sections.append('\n'.join(sec))
tbl = ['| ID | Name | Group | Rows | Refreshed | Age (d) | Status | Cadence | Location |', '|---|---|---|---|---|---|---|---|---|']
for r in rows: tbl.append(f'| {r[0]} | {r[1]} | {r[2].split(",")[0]} | {r[3] if r[3] is not None else "n/a"} | {r[4]} | {r[5]} | {r[6]} | {r[7]} | {r[8]} |')
stl = ['| ID | Name | Last refreshed | Age (d) | Rows | Why it matters |', '|---|---|---|---|---|---|'] + [f'| {a} | {b} | {c} | {d} | {e} | {f} |' for a, b, c, d, e, f in stale]
open(f'{S}/_sections.md', 'w').write('\n'.join(sections))
open(f'{S}/_table.md', 'w').write('\n'.join(tbl))
open(f'{S}/_stale.md', 'w').write('\n'.join(stl))
# fill row counts into catalog csv
p = f'{B}/socrata_catalog.csv'
cr = list(csv.DictReader(open(p)))
cmap = {i: cnt(v) for i, v in P.items() if '_error' not in v}
for r in cr:
    if cmap.get(r['id']) is not None: r['row_count'] = cmap[r['id']]
    r['stale_gt_90d'] = 'Y' if r['data_updated_at'] and (TODAY - datetime.date.fromisoformat(r['data_updated_at'])).days > 90 else ''
    r['probed'] = 'Y' if r['id'] in P else ''
w = csv.DictWriter(open(p, 'w', newline=''), fieldnames=list(cr[0])); w.writeheader(); w.writerows(cr)
print(len(rows), 'datasets,', len(stale), 'stale')
