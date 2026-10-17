#!/bin/sh
# ABOUTME: Exports data/bench.sqlite to data/bench.sql for `wrangler d1 execute --file`.
# ABOUTME: Strips BEGIN/COMMIT, PRAGMA and sqlite_sequence lines that D1 rejects.
cd "$(dirname "$0")/../data" && sqlite3 bench.sqlite .dump | grep -v -x -e 'BEGIN TRANSACTION;' -e 'COMMIT;' | grep -v -e '^PRAGMA ' -e 'sqlite_sequence' > bench.sql
