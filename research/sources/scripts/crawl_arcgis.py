# ABOUTME: Crawls the New Orleans ArcGIS REST directory (folders, services, layers) into a JSON inventory.
# ABOUTME: Polite (>=1s between requests); writes samples/arcgis/inventory.json.
import json, sys, time, urllib.request, urllib.parse
BASE = "https://maps.nola.gov/server/rest/services"
UA = "seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
OUT = sys.argv[1] if len(sys.argv) > 1 else "samples/arcgis/inventory.json"
def get(url, **p):
    p["f"] = "json"
    u = url + ("&" if "?" in url else "?") + urllib.parse.urlencode(p)
    time.sleep(1.0)
    for _ in range(3):
        try:
            r = urllib.request.Request(u, headers={"User-Agent": UA})
            return json.load(urllib.request.urlopen(r, timeout=60))
        except Exception as e:
            err = str(e); time.sleep(2)
    return {"error": err}
inv = []
root = get(BASE)
for folder in root.get("folders", []):
    d = get(f"{BASE}/{folder}")
    for s in d.get("services", []):
        if s["type"] not in ("MapServer", "FeatureServer"): continue
        url = f"{BASE}/{s['name']}/{s['type']}"
        meta = get(url)
        for l in meta.get("layers", []):
            lu = f"{url}/{l['id']}"
            ld = get(lu)
            cnt = get(lu + "/query", where="1=1", returnCountOnly="true") if ld.get("type") == "Feature Layer" else {}
            inv.append({"service": s["name"], "type": s["type"], "layer_url": lu, "id": l["id"], "name": ld.get("name", l["name"]),
                "geometryType": ld.get("geometryType"), "count": cnt.get("count"), "maxRecordCount": ld.get("maxRecordCount"),
                "supportsPagination": (ld.get("advancedQueryCapabilities") or {}).get("supportsPagination"),
                "lastEditDate": (ld.get("editingInfo") or {}).get("lastEditDate"),
                "wkid": (ld.get("extent") or {}).get("spatialReference", {}).get("latestWkid"),
                "fields": [f["name"] for f in (ld.get("fields") or [])], "error": ld.get("error")})
        print(s["name"], len(meta.get("layers", [])), file=sys.stderr)
json.dump(inv, open(OUT, "w"), indent=1)
