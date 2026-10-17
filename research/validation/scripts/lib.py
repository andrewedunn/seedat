# ABOUTME: Shared helpers for validation scripts: polite JSON GET with UA and delay.
# ABOUTME: Used for data.nola.gov and maps.nola.gov queries.
import json, time, urllib.request, urllib.parse
UA="seedat-research/0.1 (+https://seedat.dunn.us; seedat@dunn.us)"
def getj(url, params=None, delay=1.1):
    if params: url+= ("&" if "?" in url else "?")+urllib.parse.urlencode(params)
    for i in range(3):
        try:
            r=urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':UA}),timeout=180)
            d=json.load(r); time.sleep(delay); return d
        except Exception as e:
            err=e; time.sleep(3)
    raise err
def soc(ds, params): return getj(f"https://data.nola.gov/resource/{ds}.json", params)
