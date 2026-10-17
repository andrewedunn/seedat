# ABOUTME: Check code enforcement case geopin against parcel GEOPIN keyspace (Parcels and Parcels To Join).
# ABOUTME: Samples 500 most recent cases, reports null rate and match rate.
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from lib import soc
D=os.path.join(os.path.dirname(__file__),'..','data')
par={r['geopin'] for r in json.load(open(f'{D}/v9q5-fz7t.json'))}; ptj={r['geopin'] for r in json.load(open(f'{D}/pzqp-4ri7.json'))}
print('overall', soc('u6yx-v2tw',{'$select':'count(*)'}), 'geopin non-null', soc('u6yx-v2tw',{'$select':'count(geopin)'}))
for label,where in [('500 most recent cases (any)',"casefiled IS NOT NULL"),('500 most recent with geopin',"geopin IS NOT NULL")]:
    rows=soc('u6yx-v2tw',{'$where':where,'$order':'casefiled DESC','$limit':500,'$select':'caseno,casefiled,geopin,location'})
    nn=[r['geopin'].strip() for r in rows if r.get('geopin')]
    print(label,'n',len(rows),'non-null geopin',len(nn),'in Parcels',sum(g in par for g in nn),'in PTJ',sum(g in ptj for g in nn),
          'range',rows[-1]['casefiled'],rows[0]['casefiled'])
    miss=[g for g in nn if g not in par][:8]; print(' miss examples',miss)
