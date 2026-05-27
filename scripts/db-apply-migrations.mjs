#!/usr/bin/env node
// Aplica migrations SQL post-prisma no Supabase NutriCore via pg client.
//
// Uso:
//   node scripts/db-apply-migrations.mjs 023 024 025
//   node scripts/db-apply-migrations.mjs --all-missing

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "file:///C:/Users/kamila/Documents/ERP%20nutri/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

const { Client } = pg;

function loadEnv() {
  const raw = readFileSync(
    "C:/Users/kamila/Documents/ERP nutri/apps/web/.env.local",
    "utf8",
  );
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/^﻿/, "");
    env[m[1]] = value;
  }
  return env;
}

const MIGRATIONS_DIR =
  "C:/Users/kamila/Documents/ERP nutri/packages/db/prisma/migrations/post-prisma";

function listMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql") && /^\d{3}_/.test(f))
    .sort();
}

const args = process.argv.slice(2);
let migrationsToApply;

if (args.includes("--all-missing")) {
  // TODO: query supabase_migrations.schema_migrations if exists
  console.error("--all-missing not implemented yet. Use explicit numbers.");
  process.exit(1);
} else {
  const allFiles = listMigrations();
  migrationsToApply = args.map((num) => {
    const padded = num.padStart(3, "0");
    const match = allFiles.find((f) => f.startsWith(padded + "_"));
    if (!match) {
      console.error(`Migration ${padded}_* not found`);
      process.exit(1);
    }
    return match;
  });
}

if (migrationsToApply.length === 0) {
  console.error("Usage: db-apply-migrations.mjs <num> [<num>...]");
  console.error("Example: db-apply-migrations.mjs 023 024 025");
  process.exit(1);
}

const env = loadEnv();
const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL/DIRECT_URL");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
console.log(`✓ Connected to Supabase\n`);

let succeeded = 0;
let failed = 0;
for (const file of migrationsToApply) {
  const path = resolve(MIGRATIONS_DIR, file);
  const sql = readFileSync(path, "utf8");
  console.log(`▶ Applying ${file} (${sql.split("\n").length} lines)...`);
  try {
    await client.query(sql);
    console.log(`  ✓ OK\n`);
    succeeded++;
  } catch (err) {
    console.error(`  ✗ FAILED: ${err.message}`);
    if (err.position) console.error(`    at position ${err.position}`);
    if (err.detail) console.error(`    detail: ${err.detail}`);
    failed++;
    // Don't continue on first failure — explicit decision later
    break;
  }
}

console.log(
  `\n=== Summary: ${succeeded}/${migrationsToApply.length} migrations applied successfully ===`,
);
if (failed > 0) {
  console.log(`✗ ${failed} migration(s) failed — stopped at first error`);
}

await client.end();
process.exit(failed > 0 ? 1 : 0);
