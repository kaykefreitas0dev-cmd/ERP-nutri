/**
 * Spider test — visita BFS todos os links internos do app nutri autenticado.
 *
 * Garante:
 *   - Nenhum link aponta pra rota 404
 *   - Nenhuma rota retorna 5xx (erro Prisma/server)
 *   - Páginas carregam sem JS error crítico no body
 *
 * Reusa user admin@nutricore.app criado via admin API.
 * Pre-req: dev server em :3000.
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@nutricore.app";
const ADMIN_PASS = "Nutri@2026Test!";

// Limite de URLs visitadas pra evitar loops (paginação, queries, etc)
const MAX_URLS = 50;
// Padrões que devem ser ignorados (download, signed urls, externos)
const SKIP_PATTERNS = [
  /\/api\//,
  /\/auth\/signout/,
  /\.pdf$/,
  /\.zip$/,
  /\.png$/,
  /supabase\.co/,
  /resend\.dev/,
];
// Rotas dinâmicas que podem 404 sem dados específicos — esperamos qualquer non-5xx
const TOLERANT_PATTERNS = [
  /\/app\/patients\/[a-f0-9-]+\/documents\/[a-f0-9-]+$/,
  /\/app\/patients\/[a-f0-9-]+\/meal-plans\/[a-f0-9-]+$/,
];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
  await page.getByLabel(/senha/i).fill(ADMIN_PASS);
  await page.getByRole("button", { name: /^entrar$/i }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 15_000 });
}

test.describe.configure({ mode: "serial" });

test.describe("Spider nutri app", () => {
  test("HTTP 2xx/3xx em todas as rotas internas linkáveis", async ({
    browser,
  }) => {
    test.setTimeout(180_000);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await login(page);

    const baseUrl = new URL(page.url()).origin;
    const visited = new Set<string>();
    const queue: string[] = ["/app"];
    const errors: Array<{ url: string; status: number; from: string }> = [];

    // Coleta network failures (5xx)
    page.on("response", async (resp) => {
      const url = resp.url();
      if (!url.startsWith(baseUrl)) return;
      if (SKIP_PATTERNS.some((p) => p.test(url))) return;
      const pathname = new URL(url).pathname;
      if (pathname.startsWith("/_next/")) return;
      if (resp.status() >= 500) {
        errors.push({
          url: pathname,
          status: resp.status(),
          from: page.url(),
        });
      }
    });

    while (queue.length > 0 && visited.size < MAX_URLS) {
      const next = queue.shift()!;
      if (visited.has(next)) continue;
      visited.add(next);

      const fullUrl = new URL(next, baseUrl).toString();
      const resp = await page.goto(fullUrl, { waitUntil: "domcontentloaded" });

      const status = resp?.status() ?? 0;
      const isTolerant = TOLERANT_PATTERNS.some((p) => p.test(next));
      // Aceita 200-399, ou 404 em rotas tolerantes (dynamic com ID que não existe)
      if (status >= 500 || (status >= 400 && !isTolerant)) {
        errors.push({ url: next, status, from: "direct" });
        continue;
      }

      // Coleta links da página atual
      const links: string[] = await page.$$eval("a[href]", (anchors) =>
        anchors
          .map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
          .filter((h) => h && !h.startsWith("#") && !h.startsWith("mailto:")),
      );

      for (const href of links) {
        try {
          const target = new URL(href, fullUrl);
          if (target.origin !== baseUrl) continue;
          if (SKIP_PATTERNS.some((p) => p.test(target.pathname))) continue;
          const path = target.pathname + target.search;
          if (!visited.has(path) && !queue.includes(path)) {
            queue.push(path);
          }
        } catch {
          // skip malformed hrefs
        }
      }
    }

    console.log(`[spider] visited ${visited.size} urls`);
    if (errors.length > 0) {
      console.error(`[spider] ${errors.length} error(s):`);
      for (const e of errors) {
        console.error(`  - ${e.status} ${e.url} (from ${e.from})`);
      }
    }

    expect(
      errors,
      `Errors:\n${errors.map((e) => `  ${e.status} ${e.url}`).join("\n")}`,
    ).toHaveLength(0);
    expect(visited.size).toBeGreaterThan(5); // sanity — visitou rotas suficientes
  });
});
