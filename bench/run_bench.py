# ABOUTME: Client for the D1 latency benchmark: hits the seedat-bench Worker and reports p50/p95/p99 timings.
# ABOUTME: Measures end-to-end time from this machine and the Worker's own D1 batch time (d1_ms).
import json
import statistics
import sys
import time
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "https://seedat-bench.andrewdunn.workers.dev"
N = int(sys.argv[2]) if len(sys.argv) > 2 else 100


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]


def run(path):
    t0 = time.perf_counter()
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "seedat-bench/0.1"})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = json.loads(r.read())
        st = r.headers.get("server-timing", "")
    total = (time.perf_counter() - t0) * 1000
    worker_ms = float(st.split("dur=")[1]) if "dur=" in st else None
    return total, body.get("d1_ms"), worker_ms, body


def summarize(name, rows):
    e2e = [r[0] for r in rows]
    d1 = [r[1] for r in rows if r[1] is not None]
    wk = [r[2] for r in rows if r[2] is not None]
    print(f"{name}: n={len(rows)}")
    print(f"  end-to-end ms  p50={pct(e2e,50):.0f} p95={pct(e2e,95):.0f} p99={pct(e2e,99):.0f} max={max(e2e):.0f}")
    if d1:
        print(f"  D1 batch ms    p50={pct(d1,50):.0f} p95={pct(d1,95):.0f} p99={pct(d1,99):.0f}")
    if wk:
        print(f"  worker ms      p50={pct(wk,50):.0f} p95={pct(wk,95):.0f} p99={pct(wk,99):.0f}")


if __name__ == "__main__":
    rows = [run("/random") for _ in range(N)]
    summarize("random parcel page (5 queries in one batch)", rows)
    heavy = [r for r in rows if r[3].get("permits") and len(r[3]["permits"]) > 5]
    print(f"  pages with >5 permits: {len(heavy)}")
    addr = [run("/a?q=3210%20GRAVIER%20STREET") for _ in range(max(10, N // 5))]
    summarize("address lookup + page", addr)
