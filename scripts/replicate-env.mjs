#!/usr/bin/env node
// Replica env vars do web para patient + marketing nos 3 ambientes Vercel.
// Lê valores de %TEMP%/web-env.json (gerado previamente).

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const values = JSON.parse(
  readFileSync(join(tmpdir(), "web-env.json"), "utf8"),
);

// Mapa: app dir → lista de keys a setar
const PLAN = {
  "apps/patient": [
    "DATABASE_URL",
    "DIRECT_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "EMAIL_PROVIDER",
  ],
  "apps/marketing": [
    "DIRECT_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
  ],
};

// Extras não vindos do web-env (valores literais)
const EXTRA = {
  "apps/marketing": {
    NEXT_PUBLIC_WEB_APP_URL: "https://erp-nutri-web.vercel.app",
  },
};

const ENVS = ["production", "development", "preview"];
const ROOT = "C:/Users/kamila/Documents/ERP nutri";

function setEnv(appDir, key, value, env) {
  try {
    // echo value | vercel env add KEY env  (--force overwrites se existir)
    execSync(
      `npx vercel env add ${key} ${env} --force`,
      {
        cwd: join(ROOT, appDir),
        input: value,
        stdio: ["pipe", "pipe", "pipe"],
        encoding: "utf8",
      },
    );
    return true;
  } catch (err) {
    const msg = String(err.stderr || err.stdout || err.message);
    // "already exists" sem --force suportado em algumas versões
    if (msg.includes("already") || msg.includes("exists")) return "exists";
    console.error(`    ✗ ${key} ${env}: ${msg.slice(0, 120)}`);
    return false;
  }
}

for (const [appDir, keys] of Object.entries(PLAN)) {
  console.log(`\n=== ${appDir} ===`);
  const allKeys = { ...EXTRA[appDir] };
  for (const k of keys) allKeys[k] = values[k];

  for (const [key, value] of Object.entries(allKeys)) {
    if (!value) {
      console.log(`  ⊘ ${key}: no value, skip`);
      continue;
    }
    const results = ENVS.map((env) => {
      const r = setEnv(appDir, key, value, env);
      return `${env}:${r === true ? "ok" : r === "exists" ? "exists" : "fail"}`;
    });
    console.log(`  ${key}: ${results.join(" ")}`);
  }
}

console.log("\nDone.");
