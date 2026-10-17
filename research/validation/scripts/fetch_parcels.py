# ABOUTME: Download geopin/parid (Parcels To Join) and geopin (Parcels) columns from Socrata, no geometry.
# ABOUTME: Output saved under validation/data for crosswalk matching.
import sys, os, json
sys.path.insert(0, os.path.dirname(__file__))
from lib import soc
D=os.path.join(os.path.dirname(__file__),'..','data')
for ds,sel in [('pzqp-4ri7','geopin,parid'),('v9q5-fz7t','geopin,situs_number,situs_dir,situs_street,situs_type')]:
    out=[];off=0
    while True:
        r=soc(ds,{'$select':sel,'$order':':id','$limit':50000,'$offset':off})
        out+=r; off+=50000
        if len(r)<50000: break
    json.dump(out,open(f'{D}/{ds}.json','w')); print(ds,len(out))
