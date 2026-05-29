#!/usr/bin/env node
// Verifica estado do Supabase NutriCore antes de aplicar migrations.

import { readFileSync } from "node:fs";
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

const env = loadEnv();
const url = env.DIRECT_URL || env.DATABASE_URL;
if (!url) {
  console.error("Missing DATABASE_URL/DIRECT_URL");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
console.log("✓ Connected\n");

const schemasRes = await client.query(`
  SELECT nspname FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog','information_schema','pg_toast','public','auth','storage','realtime','supabase_functions','net','extensions','vault','pgsodium','pgsodium_masks','graphql','graphql_public','_realtime','_analytics','pgbouncer','cron')
  ORDER BY nspname
`);
console.log("Custom schemas:", schemasRes.rows.map((r) => r.nspname).join(", ") || "(none)");

const nutriTables = [
  "users", "memberships", "organizations", "patients", "audit_logs",
  "anthropometry", "clinical_notes", "exam_attachments", "appointments",
  "booking_pages", "service_offerings", "meal_plans", "meal_items",
  "foods", "recipes", "clinical_documents", "cid10_codes",
  "patient_invites", "patient_payments", "user_health_checkins",
  "user_health_streaks", "health_data_points", "_keepalive",
  "service_health", "nps_feedback", "onboarding_progress",
  "consents", "permissions", "role_permissions", "data_imports",
];

const tablesRes = await client.query(`
  SELECT tablename FROM pg_tables
  WHERE schemaname = 'public' AND tablename = ANY($1::text[])
  ORDER BY tablename
`, [nutriTables]);

const present = new Set(tablesRes.rows.map((r) => r.tablename));
console.log(`\nNutriCore tables: ${present.size}/${nutriTables.length}`);
console.log("  ✓ present:", [...present].join(", ") || "(NONE!)");
const missing = nutriTables.filter((t) => !present.has(t));
console.log("  ✗ missing:", missing.join(", ") || "(all present)");

const auditFns = await client.query(`
  SELECT routine_schema || '.' || routine_name AS fn
  FROM information_schema.routines
  WHERE routine_schema IN ('audit', 'phi')
  ORDER BY fn
`);
console.log("\nAudit/PHI functions:", auditFns.rows.map((r) => r.fn).join(", ") || "(none)");

const bucketsRes = await client.query(`
  SELECT id FROM storage.buckets
  WHERE id IN ('clinical-documents', 'lgpd-exports', 'logos-empresa', 'exams')
  ORDER BY id
`);
console.log("\nStorage buckets:", bucketsRes.rows.map((r) => r.id).join(", ") || "(none)");

// Total tables in public to detect "shared with another project"
const totalRes = await client.query(`
  SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'
`);
console.log(`\nTotal tables in public: ${totalRes.rows[0].n}`);

await client.end();
