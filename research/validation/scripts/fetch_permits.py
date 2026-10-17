# ABOUTME: Fetch recent permit samples from the three NOLA Socrata permit datasets.
# ABOUTME: Saves JSON under validation/data for overlap and crosswalk analysis.
import json, time, urllib.request, urllib.parse, sys, os
UA="seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
D=os.path.join(os.path.dirname(__file__),'..','data')
def get(ds, params):
    u=f"https://data.nola.gov/resource/{ds}.json?"+urllib.parse.urlencode(params)
    r=urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA}),timeout=120)
    time.sleep(1.1); return json.load(r)
for ds,order in [('rcm3-fn58','filingdate DESC'),('72f9-bi28','applieddate DESC'),('aib5-en5t','application_submitted DESC')]:
    col=order.split()[0]; rows=get(ds,{'$where':col+' IS NOT NULL','$order':order,'$limit':1000})
    json.dump(rows,open(f'{D}/recent_{ds}.json','w'))
    print(ds,len(rows))
