# ABOUTME: Reads the data.nola.gov Socrata catalog JSON and writes a CSV of all datasets with relevance flags.
# ABOUTME: Run: python3 socrata_catalog.py (paths relative to research/sources).
import json, csv, re, datetime, os
base = os.path.join(os.path.dirname(__file__), '..')
d = json.load(open(os.path.join(base, 'samples/socrata/catalog.json')))
KW = {
 'permits': r'permit|building|construction|electrical|mechanical|plumbing|contractor',
 'code_enf': r'code enforcement|blight|inspection|hearing|violation|nuisance|abatement',
 '311': r'311|service request',
 'cfs': r'calls for service',
 'str': r'short.term|\bstr\b',
 'business': r'business licen|occupational',
 'property': r'parcel|property|assess|\blot|real estate|geopin',
 'demo': r'demolition',
 'sales': r'\bsales?\b|sold',
 'swb': r'sewerage|water board|\bswb\b',
 'zoning': r'zoning|\bclur\b|land use',
}
rows = []
for r in d['results']:
    res, cl = r['resource'], r['classification']
    text = (res['name'] + ' ' + (res.get('description') or '')[:300]).lower()
    flags = [k for k, p in KW.items() if re.search(p, res['name'].lower())] 
    flags_desc = [k for k, p in KW.items() if re.search(p, text) and k not in flags]
    ts = res.get('data_updated_at') or res.get('updatedAt')
    rows.append(dict(id=res['id'], name=res['name'], category=cl.get('domain_category') or '', type=res['type'],
        data_updated_at=(res.get('data_updated_at') or '')[:10], metadata_updated_at=(res.get('updatedAt') or '')[:10],
        created=(res.get('createdAt') or '')[:10], row_count='',
        relevance_name=';'.join(flags), relevance_desc_only=';'.join(flags_desc),
        columns=len(res.get('columns_name', [])), permalink=r['permalink']))
rows.sort(key=lambda x: (x['relevance_name'] == '', x['category'], x['name']))
w = csv.DictWriter(open(os.path.join(base, 'socrata_catalog.csv'), 'w', newline=''), fieldnames=list(rows[0]))
w.writeheader(); w.writerows(rows)
print(len(rows), 'datasets;', sum(1 for r in rows if r['relevance_name']), 'name-flagged')
