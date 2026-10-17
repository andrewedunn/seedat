#!/bin/bash
# ABOUTME: Uploads the backfill's raw Socrata pages to R2 (seedat-raw) as gzipped snapshots, so loads can be replayed.
# ABOUTME: Usage: scripts/snapshot-to-r2.sh YYYY-MM-DD   (keys: snapshots/<dataset>/<day>/page_NNNNNNN.json.gz)
set -euo pipefail
day="$1"
cd "$(dirname "$0")/.."
tmp=$(mktemp -d)
for dir in data/raw/src/*/; do
  id=$(basename "$dir")
  for page in "$dir"*.json; do
    name=$(basename "$page" .json)
    gzip -c "$page" > "$tmp/$name.json.gz"
    (cd workers/ingest && npx wrangler r2 object put "seedat-raw/snapshots/$id/$day/$name.json.gz" --file "$tmp/$name.json.gz" --content-type application/json --content-encoding gzip --remote > /dev/null)
    rm "$tmp/$name.json.gz"
  done
  echo "uploaded $id"
done
echo "SNAPSHOT DONE"
