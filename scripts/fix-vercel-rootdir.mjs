#!/usr/bin/env node
// Corrige Root Directory dos projetos Vercel patient + web para apps/<app>.
// Necessário para deploy de monorepo pnpm (contexto workspace).

import authJson from "file:///C:/Users/kamila/AppData/Roaming/xdg.data/com.vercel.cli/auth.json" with { type: "json" };

const TOKEN = authJson.token;
const TEAM = "team_tPJ6ysaZZggszky2K4IdizRy";

const PROJECTS = [
  { id: "prj_wI3Lh9ITqCaBhT80obNXNXPaEi0N", name: "patient", root: "apps/patient" },
  { id: "prj_Lckq8iwcJVFdxfo4WJfRujDVonGj", name: "web", root: "apps/web" },
];

for (const p of PROJECTS) {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${p.id}?teamId=${TEAM}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rootDirectory: p.root }),
    },
  );
  const data = await res.json();
  if (!res.ok) {
    console.error(`✗ ${p.name}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
  } else {
    console.log(`✓ ${p.name}: rootDirectory = ${data.rootDirectory}`);
  }
}
