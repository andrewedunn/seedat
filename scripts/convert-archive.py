# ABOUTME: Converts a data.nola.gov file-download archive (shapefile DBF or xlsx) into data/raw/src/<id>/ JSON pages,
# ABOUTME: shaped like Socrata rows (lowercase keys, string values, blanks omitted) so the adapters read them like any source.
# Usage: python3 -I scripts/convert-archive.py <dataset-id> <path to .dbf or .xlsx>   (xlsx needs openpyxl)
import datetime, json, os, struct, sys

ds, path = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "raw", "src", ds)
os.makedirs(out, exist_ok=True)
for old in os.listdir(out):
    os.remove(os.path.join(out, old))
PAGE = 50000


def dbf_rows(p):
    """dBASE III records; D fields become YYYY-MM-DD, deleted records are skipped."""
    with open(p, "rb") as f:
        n, header_len, rec_len = struct.unpack("<IHH", f.read(32)[4:12])
        fields = []
        while True:
            d = f.read(32)
            if d[0] == 0x0D:
                break
            fields.append((d[:11].split(b"\0")[0].decode("ascii").lower(), chr(d[11]), d[16]))
        f.seek(header_len)
        for _ in range(n):
            r = f.read(rec_len)
            if r[:1] == b"*":
                continue
            pos, row = 1, {}
            for name, kind, length in fields:
                v = r[pos:pos + length].decode("latin-1").strip()
                pos += length
                if kind == "D" and len(v) == 8 and v.isdigit():
                    v = f"{v[:4]}-{v[4:6]}-{v[6:]}"
                if v:
                    row[name] = v
            yield row


def cell(v):
    if isinstance(v, datetime.datetime):
        return v.strftime("%Y-%m-%dT%H:%M:%S")
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v).strip()


def xlsx_rows(p):
    import openpyxl
    ws = openpyxl.load_workbook(p, read_only=True).worksheets[0]
    it = ws.iter_rows(values_only=True)
    header = [str(h).strip().lower().replace("/", "_") for h in next(it)]
    for values in it:
        row = {h: cell(v) for h, v in zip(header, values) if v is not None and cell(v) != ""}
        if row:
            yield row


rows = dbf_rows(path) if path.lower().endswith(".dbf") else xlsx_rows(path)
buf, offset = [], 0
for row in rows:
    buf.append(row)
    if len(buf) == PAGE:
        with open(os.path.join(out, f"page_{offset:07d}.json"), "w") as f:
            json.dump(buf, f)
        offset += PAGE
        buf = []
with open(os.path.join(out, f"page_{offset:07d}.json"), "w") as f:
    json.dump(buf, f)
print(ds, offset + len(buf), "rows")
