# ABOUTME: Compare permit-number sets across the three permit datasets over a common filing window.
# ABOUTME: Avoids sample-window bias in the recent-1000 overlap.
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import soc
W=("2026-09-01T00:00:00","2026-10-01T00:00:00")
cfg={'rcm3-fn58':('numstring','filingdate'),'72f9-bi28':('permitnum','applieddate'),'aib5-en5t':('permitnumber','application_submitted')}
S={}
for k,(n,d) in cfg.items():
    rows=soc(k,{'$select':n,'$where':f"{d} >= '{W[0]}' and {d} < '{W[1]}'",'$limit':50000})
    S[k]={r[n] for r in rows}; print(k,len(rows),len(S[k]))
ks=list(S)
for a in ks:
    for b in ks:
        if a<b: print(a,b,'inter',len(S[a]&S[b]),'a-b',len(S[a]-S[b]),'b-a',len(S[b]-S[a]))
print('union',len(set().union(*S.values())),'all3',len(S[ks[0]]&S[ks[1]]&S[ks[2]]))
