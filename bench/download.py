# ABOUTME: Polite, resumable downloader for NOLA ArcGIS and Socrata tables into data/raw/<source>/ page files.
# ABOUTME: Usage: download.py [lama|parcels|permits|code|str ...]; skips pages already on disk.
import json, os, sys, time, requests
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw")
S = requests.Session()
S.headers["User-Agent"] = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
_last = [0.0]

def get(url, params):
    for attempt in range(6):
        wait = 1.0 - (time.time() - _last[0])
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            r = S.get(url, params=params, timeout=180)
            if r.status_code == 200:
                j = r.json()
                if isinstance(j, dict) and "error" in j: raise RuntimeError(j["error"])
                return j
            print("HTTP", r.status_code, flush=True)
        except Exception as e:
            print("retry", attempt, e, flush=True)
        time.sleep(5 * (attempt + 1))
    raise SystemExit("giving up on " + url)

def arcgis(name, url, fields, geom):
    d = os.path.join(ROOT, name); os.makedirs(d, exist_ok=True)
    off = 0
    while True:
        f = os.path.join(d, "page_%07d.json" % off)
        if os.path.exists(f):
            j = json.load(open(f))
        else:
            j = get(url, dict(where="1=1", outFields=fields, orderByFields="OBJECTID", resultOffset=off,
                              resultRecordCount=2000, returnGeometry=str(geom).lower(), outSR=4326, f="json"))
            json.dump(j, open(f, "w"))
        n = len(j.get("features", []))
        print(name, off, n, flush=True)
        if n == 0 or (not j.get("exceededTransferLimit") and n < 2000): break
        off += n

def socrata(name, url, limit=50000):
    d = os.path.join(ROOT, name); os.makedirs(d, exist_ok=True)
    off = 0
    while True:
        f = os.path.join(d, "page_%07d.json" % off)
        if os.path.exists(f):
            j = json.load(open(f))
        else:
            j = get(url, {"$limit": limit, "$offset": off, "$order": ":id"})
            json.dump(j, open(f, "w"))
        print(name, off, len(j), flush=True)
        if len(j) < limit: break
        off += len(j)

JOBS = {
 "lama": lambda: arcgis("lama", "https://maps.nola.gov/server/rest/services/Addresses/Site_Address_Point_LAMA/MapServer/0/query",
        "SITEADDID,FULLADDR,ADDRNUM,FULLNAME,UNITTYPE,UNITID,STATUS,GEOPIN,ZCTA5CE10", True),
 "parcels": lambda: arcgis("parcels", "https://maps.nola.gov/server/rest/services/Assessor/Landbase_Layers/MapServer/0/query",
        "GEOPIN,SITUS_NUMBER,SITUS_DIR,SITUS_STREET,SITUS_TYPE,ACRES", True),
 "permits": lambda: socrata("permits", "https://data.nola.gov/resource/72f9-bi28.json"),
 "code": lambda: socrata("code", "https://data.nola.gov/resource/u6yx-v2tw.json"),
 "str": lambda: socrata("str", "https://data.nola.gov/resource/en36-xvxg.json"),
}
if __name__ == "__main__":
    for k in (sys.argv[1:] or JOBS): JOBS[k]()
