// ABOUTME: Computes parcel_summary for every parcel in seedat-db, in chunks, using the same SQL the nightly Worker runs.
// ABOUTME: Usage: npx tsx scripts/backfill-summary.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sqlValue } from "../packages/core/src/sql";
import { parcelSummarySql } from "../packages/core/src/summary-sql";
import { loadSqlFiles, writeSqlFiles } from "./lib/d1";
import { DATA } from "./lib/raw";

const geopins = readFileSync(join(DATA, "derived", "parcels.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l).geopin as number);
const sql = parcelSummarySql(new Date().toISOString());
const statements: string[] = [];
for (let i = 0; i < geopins.length; i += 2000) statements.push(sql.replace("json_each(?)", `json_each(${sqlValue(JSON.stringify(geopins.slice(i, i + 2000)))})`));
loadSqlFiles(writeSqlFiles("summary", statements));
console.log(`parcel_summary computed for ${geopins.length} parcels`);
