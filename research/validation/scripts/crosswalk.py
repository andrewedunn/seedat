# ABOUTME: Test whether permit `pin` matches Parcels To Join parid or geopin, with normalization variants.
# ABOUTME: Also reports pin/parid format shapes.
import json, os, re, collections
D=os.path.join(os.path.dirname(__file__),'..','data')
ptj=json.load(open(f'{D}/pzqp-4ri7.json')); par=json.load(open(f'{D}/v9q5-fz7t.json'))
parid={r['parid'] for r in ptj if r.get('parid')}; gp_ptj={r['geopin'] for r in ptj if r.get('geopin')}
gp_par={r['geopin'] for r in par}
def shape(s): return re.sub(r'[A-Z]','A',re.sub(r'\d','9',s))
print('parid shapes',collections.Counter(shape(p) for p in parid).most_common(6))
print('PTJ rows',len(ptj),'distinct geopin',len(gp_ptj),'distinct parid',len(parid),'geopins in PTJ also in Parcels',len(gp_ptj&gp_par),'/',len(gp_par))
def norm(s): return re.sub(r'[^0-9A-Z]','',s.upper())
parid_n={norm(p) for p in parid}; parid_nz={p.lstrip('0') for p in parid_n}
for ds,col in [('72f9-bi28','pin'),('rcm3-fn58','pin')]:
    rows=[r[col].strip() for r in json.load(open(f'{D}/recent_{ds}.json')) if r.get(col)][:500]
    n=len(rows)
    print(ds,'sample with pin',n,'shapes',collections.Counter(shape(p) for p in rows).most_common(5))
    c=lambda f:sum(1 for p in rows if f(p))
    print(' exact parid',c(lambda p:p in parid),'norm parid',c(lambda p:norm(p) in parid_n),'strip-zero',c(lambda p:norm(p).lstrip('0') in parid_nz),
          '| geopin(PTJ)',c(lambda p:p in gp_ptj),'geopin(Parcels)',c(lambda p:p in gp_par),'geopin lstrip0',c(lambda p:p.lstrip('0') in gp_par))
    print(' examples',rows[:5])
# parid vs known tax-bill-like strings
print('parid sample',list(parid)[:5])
