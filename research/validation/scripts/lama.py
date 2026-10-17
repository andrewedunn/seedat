# ABOUTME: Download all LAMA site address points (no geometry) and test GEOPIN membership in parcels.
# ABOUTME: Counts come from returnCountOnly queries; paging is 2000 rows/request with delay.
import sys, os, json, random
sys.path.insert(0, os.path.dirname(__file__))
from lib import getj
D=os.path.join(os.path.dirname(__file__),'..','data')
B="https://maps.nola.gov/server/rest/services/Addresses/Site_Address_Point_LAMA/MapServer/0/query"
def cnt(w): return getj(B,{'where':w,'returnCountOnly':'true','f':'json'})['count']
tot=cnt('1=1'); nn=cnt('GEOPIN IS NOT NULL'); print('total',tot,'geopin not null',nn,f'{100*nn/tot:.1f}%',flush=True)
rows=[];off=0
while True:
    r=getj(B,{'where':'1=1','outFields':'OBJECTID,SITEADDID,FULLADDR,ADDRNUM,FULLNAME,UNITTYPE,UNITID,STATUS,GEOPIN,POINTTYPE,ADDR_TYPE','returnGeometry':'false','orderByFields':'OBJECTID','resultOffset':off,'resultRecordCount':2000,'f':'json'},delay=1.0)
    f=[x['attributes'] for x in r.get('features',[])]; rows+=f; off+=2000
    print(len(rows),flush=True)
    if not f or (len(f)<2000 and not r.get('exceededTransferLimit')): break
json.dump(rows,open(f'{D}/lama.json','w')); print('downloaded',len(rows),flush=True)
par={r['geopin'] for r in json.load(open(f'{D}/v9q5-fz7t.json'))}
g=[r for r in rows if r['GEOPIN'] not in (None,'')]
ok=lambda x: str(x['GEOPIN']).strip() in par
random.seed(1); s=random.sample(g,500)
print('sample500 geopin in parcels:',sum(map(ok,s)),flush=True)
print('all non-null geopin in parcels:',sum(map(ok,g)),'/',len(g), 'example', g[0]['GEOPIN'],flush=True)
