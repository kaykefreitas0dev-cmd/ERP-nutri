#!/usr/bin/env node
// Importa a TACO 4ª edição (oficial, UNICAMP/NEPA — domínio público) na tabela
// foods. Fonte: packages/db/prisma/seeds/taco-composicao-full.csv (597 alimentos).
//
// INSERT-only: insere apenas externalIds novos (não toca nos existentes, por
// causa do trigger de imutabilidade Lock 15). Alimentos globais (organization_id
// NULL, source TACO). externalId = TACO_<numero padded 3>.
//
// Uso: node scripts/import-taco-foods.mjs [--dry]

import { readFileSync } from "node:fs";
import pg from "file:///C:/Users/kamila/Documents/ERP%20nutri/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js";

const { Client } = pg;
const DRY = process.argv.includes("--dry");
const CSV =
  "C:/Users/kamila/Documents/ERP nutri/packages/db/prisma/seeds/taco-composicao-full.csv";

function loadEnv() {
  const raw = readFileSync(
    "C:/Users/kamila/Documents/ERP nutri/apps/web/.env.local",
    "utf8",
  );
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_][A-Z_0-9]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    )
      v = v.slice(1, -1);
    env[m[1]] = v.replace(/^﻿/, "");
  }
  return env;
}

// Parser CSV RFC4180: campos com aspas, vírgula dentro de aspas, "" escapado.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function num(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (s === "" || s === "NA" || s === "*" || s === "Tr") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

const rows = parseCsv(readFileSync(CSV, "utf8"));
const header = rows[0].map((h) => h.trim());
const idx = (name) => header.indexOf(name);
const cNum = idx("numero_alimento");
const cDesc = idx("descricao");
const cKcal = idx("energia_kcal");
const cProt = idx("proteina_g");
const cLip = idx("lipideos_g");
const cCarb = idx("carboidrato_g");
const cFib = idx("fibra_g");
const cSod = idx("sodio_mg");
const cCat = idx("categoria");

const foods = [];
for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  if (!row[cNum]) continue;
  const numero = parseInt(String(row[cNum]).trim(), 10);
  if (!Number.isFinite(numero)) continue;
  const name = (row[cDesc] ?? "").trim();
  if (!name) continue;
  foods.push({
    externalId: `TACO_${String(numero).padStart(3, "0")}`,
    name,
    category: (row[cCat] ?? "").trim().replace(/"/g, "") || null,
    kcal: num(row[cKcal]),
    protein: num(row[cProt]),
    carb: num(row[cCarb]),
    fat: num(row[cLip]),
    fiber: num(row[cFib]),
    sodium: num(row[cSod]),
  });
}
console.log(`Parsed ${foods.length} alimentos do CSV TACO.`);

const env = loadEnv();
const client = new Client({
  connectionString: env.DIRECT_URL || env.DATABASE_URL,
});
await client.connect();

const existing = await client.query(
  "SELECT external_id FROM foods WHERE source='TACO' AND external_id IS NOT NULL",
);
const have = new Set(existing.rows.map((r) => r.external_id));
const toInsert = foods.filter((f) => !have.has(f.externalId));
console.log(
  `Existentes: ${have.size} · Novos a inserir: ${toInsert.length}`,
);

if (DRY) {
  console.log("DRY-RUN — amostra:");
  console.log(JSON.stringify(toInsert.slice(0, 3), null, 2));
  await client.end();
  process.exit(0);
}

let inserted = 0;
await client.query("BEGIN");
try {
  for (const f of toInsert) {
    await client.query(
      `INSERT INTO foods
        (id, organization_id, source, external_id, name, category,
         kcal_per_100g, protein_g, carb_g, fat_g, fiber_g, sodium_mg,
         micronutrients, version, is_active, created_at, updated_at)
       VALUES (gen_random_uuid(), NULL, 'TACO', $1, $2, $3,
         $4, $5, $6, $7, $8, $9, '{}'::jsonb, 1, true, now(), now())`,
      [
        f.externalId,
        f.name,
        f.category,
        f.kcal,
        f.protein,
        f.carb,
        f.fat,
        f.fiber,
        f.sodium,
      ],
    );
    inserted++;
  }
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("FALHOU, rollback:", e.message);
  await client.end();
  process.exit(1);
}

const total = await client.query("SELECT count(*)::int n FROM foods");
console.log(`✓ Inseridos ${inserted}. Total de foods agora: ${total.rows[0].n}`);
await client.end();
