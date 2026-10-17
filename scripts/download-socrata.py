# ABOUTME: Downloads a full Socrata dataset from data.nola.gov into data/raw/<name>/ as 50k-row JSON pages.
# ABOUTME: Usage: python3 -I scripts/download-socrata.py <dataset-id> <name>   (polite: 1.1 s between pages)
import json, os, sys, time, urllib.request

ds, name = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw", name)
os.makedirs(out, exist_ok=True)
UA = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
offset, page = 0, 50000
while True:
    url = f"https://data.nola.gov/resource/{ds}.json?$limit={page}&$offset={offset}&$order=:id"
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    rows = json.load(urllib.request.urlopen(req, timeout=300))
    with open(os.path.join(out, f"page_{offset:07d}.json"), "w") as f:
        json.dump(rows, f)
    print(ds, offset, len(rows), flush=True)
    if len(rows) < page:
        break
    offset += page
    time.sleep(1.1)
