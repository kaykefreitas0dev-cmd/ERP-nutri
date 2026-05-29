#!/usr/bin/env node
// Re-seta TODAS as env vars do web (prod+dev) a partir do .env.local limpo.
// Garante que nenhuma var tem BOM/corrupção do pull antigo.
// Pula vars que o Vercel injeta automaticamente (VERCEL_*, etc.) e KV_* (Upstash managed).

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const ROOT = "C:/Users/kamila/Documents/ERP nutri/apps/web";

function loadEnv() {
  const raw = readFileSync(`${ROOT}/.env.local`, "utf8").replace(/^﻿/, "");
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
    env[m[1]] = v.replace(/^﻿/, "").replace(/﻿/g, "");
  }
  return env;
}

const env = loadEnv();

// Vars gerenciadas pela Vercel/integrações — NÃO re-setar (causam conflito)
const SKIP = new Set([
  "VERCEL_OIDC_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "KV_REST_API_READ_ONLY_TOKEN",
  "KV_URL",
  "REDIS_URL",
  "QSTASH_URL", // managed pela integração
]);

const ENVS = ["production", "development"];
const keys = Object.keys(env).filter((k) => !SKIP.has(k));

console.log(`Re-syncing ${keys.length} env vars × ${ENVS.length} environments\n`);

let ok = 0;
let fail = 0;
for (const key of keys) {
  const value = env[key];
  if (!value) continue;
  for (const e of ENVS) {
    try {
      execSync(`npx vercel env rm ${key} ${e} --yes`, {
        cwd: ROOT,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      /* não existia */
    }
    try {
      execSync(`npx vercel env add ${key} ${e}`, {
        cwd: ROOT,
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
      });
      ok++;
    } catch (err) {
      console.error(`✗ ${key} ${e}: ${String(err.stderr || err.message).slice(0, 80)}`);
      fail++;
    }
  }
  console.log(`✓ ${key} (${value.length} chars)`);
}

console.log(`\nDone: ${ok} set, ${fail} failed`);
