# ABOUTME: Compute permit-number overlap between three Socrata permit datasets.
# ABOUTME: Checks recent samples against the full other datasets via $where IN queries.
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from lib import soc
D=os.path.join(os.path.dirname(__file__),'..','data')
cfg={'rcm3-fn58':'numstring','72f9-bi28':'permitnum','aib5-en5t':'permitnumber'}
samp={k:[r[c] for r in json.load(open(f'{D}/recent_{k}.json')) if c in r] for k,c in cfg.items()}
for k,v in samp.items(): print(k,'sample',len(v),'unique',len(set(v)),'eg',v[:3])
for a in cfg:
    for b in cfg:
        if a==b: continue
        nums=sorted(set(samp[a])); found=set()
        for i in range(0,len(nums),100):
            chunk=nums[i:i+100]
            inl=",".join("'"+n.replace("'","''")+"'" for n in chunk)
            rows=soc(b,{'$select':cfg[b],'$where':f"{cfg[b]} in ({inl})",'$limit':1000})
            found|={r[cfg[b]] for r in rows}
        print(f"{a} recent sample -> present in {b}: {len(found)}/{len(nums)} = {100*len(found)/len(nums):.1f}%")
