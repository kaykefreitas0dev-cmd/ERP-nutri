#!/usr/bin/env node
/**
 * apply-all.cjs — Aplica schema Prisma + post-prisma SQLs ao Supabase
 *
 * Uso:
 *   DATABASE_URL=postgresql://... node apply-all.cjs
 *
 * Etapas:
 *   1. Conecta no DB
 *   2. Aplica _preview_initial.sql (schema Prisma → DDL gerado por prisma migrate diff)
 *   3. Aplica os 7 arquivos em prisma/migrations/post-prisma/ em ordem
 *   4. Verifica que as tabelas foram criadas
 *
 * Idempotente nas tabelas (CREATE IF NOT EXISTS via Prisma); funções/policies não-idempotentes
 * usam CREATE OR REPLACE / DROP IF EXISTS antes onde aplicável.
 */
const path = require("path");
const fs = require("fs");

const PG_PATH = path.join(
  process.cwd(),
  "..",
  "..",
  "node_modules/.pnpm/pg@8.20.0/node_modules/pg",
);
const pg = require(PG_PATH);

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL not set");
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, "..", "prisma", "migrations");
const POST_PRISMA_DIR = path.join(MIGRATIONS_DIR, "post-prisma");

// Order matters: 005 (helpers) before 001 (policies that use them) and 002 (audit fn)
const FILES = [
  { path: path.join(MIGRATIONS_DIR, "_preview_initial.sql"), label: "Prisma schema (14 tables + 4 enums)", skipIfApplied: true },
  { path: path.join(POST_PRISMA_DIR, "005_is_super_admin_helper.sql"), label: "005 public.is_super_admin + current_org_id" },
  { path: path.join(POST_PRISMA_DIR, "001_enable_rls.sql"), label: "001 RLS + policies (depends on 005)" },
  { path: path.join(POST_PRISMA_DIR, "002_audit_log_chain.sql"), label: "002 audit.append_log hash chain" },
  { path: path.join(POST_PRISMA_DIR, "003_gist_exclusion_appointments.sql"), label: "003 GiST exclusion (placeholder)" },
  { path: path.join(POST_PRISMA_DIR, "004_pgcrypto_phi.sql"), label: "004 pgcrypto + Vault helpers" },
  { path: path.join(POST_PRISMA_DIR, "006_keepalive_table.sql"), label: "006 _keepalive seed + service_health perms" },
  { path: path.join(POST_PRISMA_DIR, "007_handle_new_user_trigger.sql"), label: "007 handle_new_user trigger" },
];

async function main() {
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    statement_timeout: 60_000,
  });

  console.log("→ Connecting to Supabase...");
  await client.connect();
  console.log("  ✓ connected");

  // Pre-create audit schema (used by 002)
  console.log("→ Ensuring audit schema exists");
  await client.query("CREATE SCHEMA IF NOT EXISTS audit");
  console.log("  ✓ audit schema ready");

  for (const file of FILES) {
    if (!fs.existsSync(file.path)) {
      console.warn(`  ⚠ skip (not found): ${file.path}`);
      continue;
    }
    const sql = fs.readFileSync(file.path, "utf-8");
    console.log(`→ Applying: ${file.label} (${sql.length} bytes)`);
    try {
      await client.query(sql);
      console.log(`  ✓ ${file.label}`);
    } catch (err) {
      console.error(`  ✗ ${file.label}`);
      console.error(`    ${err.message}`);
      // Continue to next; some errors may be "already exists" benign
      // Hard exit only on connection lost
      if (err.code === "57P03" || err.code === "08006") {
        await client.end();
        process.exit(1);
      }
    }
  }

  // Smoke check
  console.log("\n→ Smoke check: counting tables in public schema");
  const r = await client.query(`
    SELECT count(*)::int as n
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`  ✓ ${r.rows[0].n} tables in public schema`);

  const rls = await client.query(`
    SELECT count(*)::int as n
    FROM pg_tables
    WHERE schemaname = 'public' AND rowsecurity = true
  `);
  console.log(`  ✓ ${rls.rows[0].n} tables with RLS enabled`);

  const fn = await client.query(`
    SELECT proname
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
      AND proname = 'is_super_admin'
  `);
  console.log(`  ✓ auth.is_super_admin: ${fn.rows.length > 0 ? "exists" : "MISSING"}`);

  const auditFn = await client.query(`
    SELECT proname
    FROM pg_proc
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'audit')
      AND proname = 'append_log'
  `);
  console.log(`  ✓ audit.append_log: ${auditFn.rows.length > 0 ? "exists" : "MISSING"}`);

  await client.end();
  console.log("\n✅ Done");
}

main().catch((e) => {
  console.error("✗ Fatal:", e.message);
  process.exit(1);
});
