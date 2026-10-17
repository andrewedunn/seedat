# ABOUTME: Probes selected data.nola.gov datasets: trimmed metadata, 3 sample rows, row count, min/max of date columns.
# ABOUTME: Writes samples/socrata/<id>.meta.json, <id>.sample.json and probe_summary.json; 1s+ between requests.
import json, os, sys, time, urllib.request, urllib.parse
q = lambda x: urllib.parse.quote(x, safe='$=&,()*:')
UA = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
OUT = os.path.join(os.path.dirname(__file__), '../samples/socrata')
IDS = sys.argv[1:]
def get(url):
    time.sleep(1.1)
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    try:
        return json.load(urllib.request.urlopen(req, timeout=90))
    except Exception as e:
        return {'_error': str(e)}
summary = {}
for i in IDS:
    m = get(f'https://data.nola.gov/api/views/{i}.json')
    if '_error' in m: summary[i] = m; continue
    cols = [dict(f=c.get('fieldName'), n=c.get('name'), t=c.get('dataTypeName')) for c in m.get('columns', []) if not c.get('fieldName','').startswith(':@')]
    meta = {k: m.get(k) for k in ('id','name','assetType','viewType','category','attribution','attributionLink','licenseId','license','rowsUpdatedAt','createdAt','viewLastModified','publicationDate','rowIdentifierColumnId','tags','metadata')}
    meta['description'] = (m.get('description') or '')[:3000]
    meta['rowsUpdatedAt'] = time.strftime('%Y-%m-%d %H:%M', time.gmtime(m['rowsUpdatedAt'])) if m.get('rowsUpdatedAt') else None
    meta['columns'] = cols
    s = {'id': i, 'name': m.get('name'), 'type': m.get('viewType'), 'assetType': m.get('assetType'), 'rowsUpdatedAt': meta['rowsUpdatedAt'], 'ncols': len(cols), 'cols': cols}
    if m.get('viewType') == 'tabular' and m.get('assetType') != 'filter' and not m.get('approvals') is None or m.get('viewType') == 'tabular':
        base = f'https://data.nola.gov/resource/{i}.json'
        s['count'] = get(base + '?$select=' + q('count(*)'))
        samp = get(base + '?$limit=3')
        json.dump(samp, open(f'{OUT}/{i}.sample.json', 'w'), indent=1)
        mm = {}
        for c in cols:
            if c['t'] in ('calendar_date', 'date') :
                r = get(base + '?$select=' + q(f"min({c['f']}) as mn,max({c['f']}) as mx"))
                mm[c['f']] = r[0] if isinstance(r, list) and r else r
        s['dates'] = mm
        s['updated_at_max'] = get(base + '?$select=' + q('max(:updated_at) as u,max(:created_at) as c'))
    json.dump(meta, open(f'{OUT}/{i}.meta.json', 'w'), indent=1)
    summary[i] = s
    print(i, s['name'], s.get('count'), s['rowsUpdatedAt'], flush=True)
p = f'{OUT}/probe_summary.json'
old = json.load(open(p)) if os.path.exists(p) else {}
old.update(summary); json.dump(old, open(p, 'w'), indent=1)
