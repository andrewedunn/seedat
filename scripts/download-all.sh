#!/bin/bash
# ABOUTME: Downloads every Socrata source in the adapter registry into data/raw/src/<id>/, one dataset at a time.
# ABOUTME: Usage: scripts/download-all.sh   (writes a line per dataset to stdout; safe to re-run)
set -euo pipefail
cd "$(dirname "$0")/.."
# File-download archives (Accela, LAMA) are not SODA datasets: fetch their zip and run scripts/convert-archive.py instead.
ids=$(npx tsx -e 'import { allSources } from "./packages/core/src/sources"; console.log(allSources.filter((s) => s.url.includes("/resource/")).map((s) => s.sourceId.replace("socrata:", "")).join(" "))')
for id in $ids; do
  python3 -I scripts/download-socrata.py "$id" > /dev/null
  echo "done $id $(cat data/raw/src/$id/*.json | wc -c) bytes"
done
echo "ALL DONE"
