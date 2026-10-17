#!/bin/bash
# ABOUTME: Loads SQL files into the remote seedat-db in order, retrying transient API errors and stopping on real ones.
# ABOUTME: Usage: scripts/load-sql.sh data/sql/<prefix>-*.sql   (verify locally with sqlite3 first)
cd "$(dirname "$0")/../workers/ingest" || exit 1
for f in "$@"; do
  [[ "$f" = /* ]] || f="../../$f"
  ok=0
  for try in 1 2 3 4; do
    out=$(npx wrangler d1 execute seedat-db --remote --file "$f" -y 2>&1)
    if ! echo "$out" | grep -q ERROR; then ok=1; echo "ok $(basename "$f")"; break; fi
    err=$(echo "$out" | grep ERROR | head -1 | cut -c1-200)
    echo "$err" | grep -q "SQLITE_" && { echo "FATAL $(basename "$f"): $err"; exit 1; }
    echo "retry $try $(basename "$f"): $err"; sleep 30
  done
  [ $ok = 1 ] || { echo "GAVE UP $f"; exit 1; }
done
echo "ALL LOADED"
