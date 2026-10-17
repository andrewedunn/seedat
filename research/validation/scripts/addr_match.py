# ABOUTME: Baseline exact-match rate of permit addresses against LAMA FULLADDR, two normalization passes.
# ABOUTME: Pass 1 = uppercase+whitespace; pass 2 = suffix/direction abbreviations, unit strip, range-to-first-number.
import json, os, re, random, sys
D=os.path.join(os.path.dirname(__file__),'..','data')
lama=json.load(open(f'{D}/lama.json'))
def p1(s): return re.sub(r'\s+',' ',(s or '').upper()).strip()
SUF={'STREET':'ST','AVENUE':'AVE','BOULEVARD':'BLVD','DRIVE':'DR','ROAD':'RD','PLACE':'PL','COURT':'CT','LANE':'LN','HIGHWAY':'HWY','PARKWAY':'PKWY','TERRACE':'TER','CIRCLE':'CIR','ALLEY':'ALY','EXPRESSWAY':'EXPY','NORTH':'N','SOUTH':'S','EAST':'E','WEST':'W'}
UNIT=re.compile(r'\s*(?:[-,#]\s*)?\b(?:APT|APARTMENT|UNIT|STE|SUITE|BLDG|BUILDING|FL|FLOOR|RM|ROOM|LOT)\b.*$|\s+#.*$')
def p2(s):
    s=p1(s); s=s.replace('.','').replace(',',' ')
    s=UNIT.sub('',s)
    s=re.sub(r'^(\d+)[A-Z]?\s*-\s*\d+[A-Z]?\b',r'\1',s)   # 5415-5417 -> 5415
    s=re.sub(r'\s+-\s*\S+$','',s)                          # trailing "-2B"
    return ' '.join(SUF.get(t,t) for t in s.split())
idx1={p1(r['FULLADDR']) for r in lama if r['FULLADDR']}
idx2={p2(r['FULLADDR']) for r in lama if r['FULLADDR']}
print('LAMA rows',len(lama),'distinct FULLADDR',len(idx1),'e.g.',random.Random(2).sample(sorted(idx1),5))
out={}
for name,fn,col in [('72f9-bi28 BLDS','recent_72f9-bi28.json','originaladdress1'),('rcm3-fn58','recent_rcm3-fn58.json','address')]:
    rows=[r[col] for r in json.load(open(f'{D}/{fn}')) if r.get(col)][:1000]
    m1=[a for a in rows if p1(a) in idx1]; m2=[a for a in rows if p2(a) in idx2]
    miss=[a for a in rows if p2(a) not in idx2]
    print(f'{name}: n={len(rows)} pass1 exact={len(m1)} ({100*len(m1)/len(rows):.1f}%) pass2={len(m2)} ({100*len(m2)/len(rows):.1f}%)')
    print(' 20 misses after pass2:',miss[:20])
    out[name]=dict(n=len(rows),p1=len(m1),p2=len(m2),misses=miss[:20])
json.dump(out,open(f'{D}/addr_match_result.json','w'),indent=1)
