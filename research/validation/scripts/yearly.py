# ABOUTME: Yearly row counts per permit dataset and null counts, to compare coverage.
# ABOUTME: Also reports :updated_at distribution for claim 6.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import soc
for k,d in [('rcm3-fn58','filingdate'),('72f9-bi28','applieddate'),('aib5-en5t','application_submitted')]:
    r=soc(k,{'$select':f'date_extract_y({d}) as y, count(*) as n','$group':'y','$order':'y'})
    print(k,{x.get('y'):x['n'] for x in r})
    print(' null date:',soc(k,{'$select':'count(*)','$where':f'{d} IS NULL'}))
for k in ['rcm3-fn58','u6yx-v2tw','2jgv-pqrq']:
    r=soc(k,{'$select':':updated_at, count(*)','$group':':updated_at','$order':'count(*) desc','$limit':5})
    print(k,'updated_at groups',r)
    print(' total',soc(k,{'$select':'count(*)'}))
