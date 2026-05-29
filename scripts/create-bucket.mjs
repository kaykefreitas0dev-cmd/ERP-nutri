#!/usr/bin/env node
// Cria bucket no Supabase Storage via REST API.

import { readFileSync } from "node:fs";

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
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HEADERS = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

const buckets = [
  {
    id: "lgpd-exports",
    name: "lgpd-exports",
    public: false,
    file_size_limit: 50 * 1024 * 1024,
    allowed_mime_types: ["application/zip"],
  },
];

for (const b of buckets) {
  const r = await fetch(`${URL}/storage/v1/bucket`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(b),
  });
  const text = await r.text();
  console.log(`${b.id}: ${r.status} ${text.slice(0, 200)}`);
}
