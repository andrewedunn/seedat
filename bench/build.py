# ABOUTME: Builds data/bench.sqlite (realistic-volume See Dat tables) from raw pages in data/raw/ for a D1 latency benchmark.
# ABOUTME: Matches permits/code cases/STR licenses to geopins by naive address match, falling back to a random parcel.
import glob, json, os, random, re, sqlite3, time

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "..", "data", "raw")
DB = os.path.join(HERE, "..", "data", "bench.sqlite")
random.seed(42)

def pages(src):
    for f in sorted(glob.glob(os.path.join(RAW, src, "page_*.json"))):
        yield json.load(open(f))

def collapse(s):
    return re.sub(r"\s+", " ", (s or "").strip()).upper()

SUFFIX = {"ST": "STREET", "AVE": "AVENUE", "BLVD": "BOULEVARD", "DR": "DRIVE", "RD": "ROAD", "PL": "PLACE",
          "CT": "COURT", "LN": "LANE", "PKWY": "PARKWAY", "HWY": "HIGHWAY"}
UNIT_RE = re.compile(r"\s*(#|\bAPT\b|\bUNIT\b|\bSTE\b|\bSUITE\b|\bBLDG\b|\bRM\b|\bFL\b).*$")

def norm_addr(raw):
    """Uppercase, drop city suffix and unit suffix, expand the trailing street-type abbreviation."""
    s = collapse(raw)
    s = re.sub(r",?\s*NEW ORLEANS.*$", "", s)
    s = s.split(",")[0]
    s = UNIT_RE.sub("", s).strip()
    toks = s.split(" ")
    if toks and toks[-1] in SUFFIX:
        toks[-1] = SUFFIX[toks[-1]]
    return " ".join(toks)

def centroid_bbox(rings):
    pts = rings[0]
    n = len(pts)
    return sum(p[1] for p in pts) / n, sum(p[0] for p in pts) / n

SCHEMA = """
CREATE TABLE parcel(geopin INTEGER PRIMARY KEY, situs TEXT, lat REAL, lon REAL, zoning TEXT, historic_district TEXT,
  nr_district TEXT, neighborhood TEXT, council_district TEXT, summary TEXT);
CREATE TABLE address(siteaddid INTEGER PRIMARY KEY, fulladdr TEXT, addr_key TEXT, geopin INTEGER, unit TEXT, status TEXT, lat REAL, lon REAL);
CREATE TABLE permit(permit_num TEXT PRIMARY KEY, geopin INTEGER, address TEXT, type TEXT, description TEXT, status TEXT,
  applied_date TEXT, issued_date TEXT, est_cost REAL, contractor TEXT, raw_json TEXT);
CREATE TABLE code_case(case_id INTEGER PRIMARY KEY, case_no TEXT, geopin INTEGER, address TEXT, status TEXT, filed_date TEXT, raw_json TEXT);
CREATE TABLE str_license(id INTEGER PRIMARY KEY AUTOINCREMENT, geopin INTEGER, address TEXT, status TEXT, license_type TEXT, raw_json TEXT);
CREATE TABLE block_activity(block_id TEXT, geopin INTEGER, kind TEXT, month TEXT, n INTEGER);
CREATE TABLE stats(key TEXT, value TEXT);
"""
INDEXES = """
CREATE INDEX idx_address_key ON address(addr_key);
CREATE INDEX idx_address_geopin ON address(geopin);
CREATE INDEX idx_permit_geopin ON permit(geopin);
CREATE INDEX idx_permit_type_issued ON permit(type, issued_date);
CREATE INDEX idx_code_case_geopin ON code_case(geopin);
CREATE INDEX idx_str_geopin ON str_license(geopin);
CREATE INDEX idx_block_activity_geopin ON block_activity(geopin);
"""

ZONING = ["HU-RD2", "HU-RM1", "HU-B1", "HU-MU", "S-RD", "S-B2", "C-1", "MU-1", "LI", "OS-N", "HU-RS", "CBD-3"]
HIST = ["Faubourg Marigny Full Control", "French Quarter Vieux Carre Commission", "Garden District Full Control",
        "Esplanade Ridge Full Control", "Treme Full Control", "Uptown Moderate Control", "Bywater Full Control", ""]
NR = ["Faubourg Marigny NR District", "Garden District NR District", "Uptown NR District", "Bywater NR District", ""]
NBHD = ["French Quarter", "Marigny", "Bywater", "Treme", "Garden District", "Uptown", "Mid-City", "Gentilly", "Lakeview",
        "Algiers Point", "Irish Channel", "St. Roch", "Broadmoor", "Carrollton", "Lower Ninth Ward"]

def main():
    t0 = time.time()
    if os.path.exists(DB): os.remove(DB)
    db = sqlite3.connect(DB)
    db.executescript("PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;" + SCHEMA)
    stats = {}

    # parcels
    rows = []
    for pg in pages("parcels"):
        for f in pg["features"]:
            a = f["attributes"]; g = f.get("geometry")
            if not g or not g.get("rings"): continue
            lat, lon = centroid_bbox(g["rings"])
            situs = " ".join(str(x) for x in (a.get("SITUS_NUMBER"), a.get("SITUS_DIR"), a.get("SITUS_STREET"), a.get("SITUS_TYPE")) if x not in (None, "", 0))
            nb = random.choice(NBHD)
            summary = (f"{situs} is a parcel of {a.get('ACRES') or 0:.3f} acres in {nb}. Zoning and overlay data shown here is "
                       f"placeholder text padded to a realistic summary length for latency benchmarking only.")[:200].ljust(200, ".")
            rows.append((int(a["GEOPIN"]), situs, lat, lon, random.choice(ZONING), random.choice(HIST), random.choice(NR),
                         nb, str(random.randint(1, 5)), summary))
    db.executemany("INSERT OR IGNORE INTO parcel VALUES (?,?,?,?,?,?,?,?,?,?)", rows)
    geopins = [r[0] for r in rows]
    gset = set(geopins)
    print("parcels", len(rows), flush=True)

    # addresses
    rows, key2gp = [], {}
    for pg in pages("lama"):
        for f in pg["features"]:
            a = f["attributes"]; g = f.get("geometry") or {}
            if not a.get("SITEADDID"): continue
            full = a.get("FULLADDR")
            gp = int(a["GEOPIN"]) if a.get("GEOPIN") and str(a["GEOPIN"]).isdigit() else None
            unit = " ".join(x for x in (a.get("UNITTYPE"), a.get("UNITID")) if x) or None
            rows.append((int(a["SITEADDID"]), full, collapse(full), gp, unit, a.get("STATUS"), g.get("y"), g.get("x")))
            if gp in gset:
                k = norm_addr(full)
                key2gp.setdefault(k, gp)
                if a.get("ADDRNUM") and a.get("FULLNAME"):
                    key2gp.setdefault(norm_addr(f"{a['ADDRNUM']} {a['FULLNAME']}"), gp)
    db.executemany("INSERT OR IGNORE INTO address VALUES (?,?,?,?,?,?,?,?)", rows)
    print("addresses", len(rows), "match keys", len(key2gp), flush=True)

    def assign(addr, tag):
        gp = key2gp.get(norm_addr(addr)) if addr else None
        if gp:
            stats[tag + "_real"] = stats.get(tag + "_real", 0) + 1
            return gp
        stats[tag + "_random"] = stats.get(tag + "_random", 0) + 1
        return random.choice(geopins)

    # permits
    seen, rows = set(), []
    total = 0
    for pg in pages("permits"):
        for r in pg:
            total += 1
            n = r.get("permitnum")
            if not n or n in seen: continue
            seen.add(n)
            addr = r.get("originaladdress1")
            try: cost = float(r.get("estprojectcost"))
            except (TypeError, ValueError): cost = None
            rows.append((n, assign(addr, "permit"), addr, r.get("permittype"), r.get("description"), r.get("statuscurrent"),
                         r.get("applieddate"), r.get("issuedate"), cost, r.get("contractorcompanyname"), json.dumps(r)))
    stats["permit_source_rows"] = total
    db.executemany("INSERT INTO permit VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
    print("permits", len(rows), flush=True)

    # code enforcement (dataset has no geopin column; address-match like permits)
    seen, rows = set(), []
    for pg in pages("code"):
        for r in pg:
            try: cid = int(r["caseid"])
            except (KeyError, ValueError): continue
            if cid in seen: continue
            seen.add(cid)
            rows.append((cid, r.get("caseno"), assign(r.get("location"), "code"), r.get("location"), r.get("o_c"),
                         r.get("casefiled"), json.dumps(r)))
    db.executemany("INSERT INTO code_case VALUES (?,?,?,?,?,?,?)", rows)
    print("code_case", len(rows), flush=True)

    # STR
    rows = []
    for pg in pages("str"):
        for r in pg:
            rows.append((assign(r.get("address"), "str"), r.get("address"), r.get("current_status"), r.get("license_type"), json.dumps(r)))
    db.executemany("INSERT INTO str_license(geopin,address,status,license_type,raw_json) VALUES (?,?,?,?,?)", rows)
    print("str", len(rows), flush=True)

    # synthetic block activity: 150k geopins x 2 kinds x 7 months
    months = [f"2026-{m:02d}" for m in range(1, 8)]
    sample = random.sample(geopins, min(150000, len(geopins)))
    def gen():
        for gp in sample:
            blk = str(gp // 100)
            for kind in ("311", "911"):
                for m in months:
                    yield (blk, gp, kind, m, random.randint(0, 40))
    db.executemany("INSERT INTO block_activity VALUES (?,?,?,?,?)", gen())

    stats["code_note"] = "u6yx-v2tw has no geopin column; geopin assigned by address match, else random"
    db.executemany("INSERT INTO stats VALUES (?,?)", [(k, str(v)) for k, v in stats.items()])
    db.executescript(INDEXES)
    db.commit()
    for t in ("parcel", "address", "permit", "code_case", "str_license", "block_activity", "stats"):
        print(t, db.execute(f"SELECT count(*) FROM {t}").fetchone()[0])
    print(stats)
    print("size MB", os.path.getsize(DB) / 1e6, "secs", time.time() - t0)

if __name__ == "__main__":
    main()
