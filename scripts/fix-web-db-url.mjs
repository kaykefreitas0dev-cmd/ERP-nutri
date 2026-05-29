#!/usr/bin/env node
// Re-seta DATABASE_URL + DIRECT_URL no web (production) com valores limpos.
// Corrige host corrompido "base" (P1001) causado por BOM no valor antigo.

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const values = JSON.parse(readFileSync(join(tmpdir(), "web-env.json"), "utf8"));
const ROOT = "C:/Users/kamila/Documents/ERP nutri/apps/web";

const KEYS = ["DATABASE_URL", "DIRECT_URL"];
const ENVS = ["production", "development"];

for (const key of KEYS) {
  const value = values[key];
  if (!value) {
    console.log(`⊘ ${key}: no value`);
    continue;
  }
  for (const env of ENVS) {
    // Remove primeiro (ignora erro se não existir)
    try {
      execSync(`npx vercel env rm ${key} ${env} --yes`, {
        cwd: ROOT,
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch {
      // ok se não existia
    }
    // Adiciona com valor limpo
    try {
      execSync(`npx vercel env add ${key} ${env}`, {
        cwd: ROOT,
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
      });
      console.log(`✓ ${key} ${env}: set (${value.length} chars, host check: ${value.includes("pooler.supabase.com") ? "OK" : "WARN"})`);
    } catch (err) {
      console.error(`✗ ${key} ${env}: ${String(err.stderr || err.message).slice(0, 120)}`);
    }
  }
}

console.log("\nDone. Redeploy needed.");
