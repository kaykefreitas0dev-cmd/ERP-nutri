/**
 * Smoke test de PRODUÇÃO — valida os 3 apps deployados online.
 *
 * Diferente dos outros specs (que assumem dev :3000), este bate nas URLs
 * de produção Vercel. Cobre health, auth, marketing, status page.
 *
 * Rodar:
 *   pnpm exec playwright test e2e/tests/06-production-smoke.spec.ts
 *
 * Override de URLs via env:
 *   PROD_WEB_URL / PROD_PATIENT_URL / PROD_MARKETING_URL
 */
import { test, expect } from "@playwright/test";

const WEB = process.env.PROD_WEB_URL ?? "https://erp-nutri-web.vercel.app";
const PATIENT =
  process.env.PROD_PATIENT_URL ?? "https://erp-nutri-patient.vercel.app";
const MARKETING =
  process.env.PROD_MARKETING_URL ?? "https://erp-nutri-marketing.vercel.app";

const LOGIN_EMAIL =
  process.env.PROD_LOGIN_EMAIL ?? "kaykefreitas0dev@gmail.com";
const LOGIN_PASS = process.env.PROD_LOGIN_PASS ?? "kayke123";

test.describe("Produção — health & APIs (web)", () => {
  test("health/live → 200 alive", async ({ request }) => {
    const res = await request.get(`${WEB}/api/health/live`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("alive");
  });

  test("health/db → 200 ok (DB conectado)", async ({ request }) => {
    const res = await request.get(`${WEB}/api/health/db`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe("ok");
  });

  test("health/ready → 200 (DB + Redis)", async ({ request }) => {
    const res = await request.get(`${WEB}/api/health/ready`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.checks.db.status).toBe("ok");
    expect(json.checks.redis.status).toBe("ok");
  });

  test("pricing-plans → 200 com planos do DB", async ({ request }) => {
    const res = await request.get(`${WEB}/api/v1/public/pricing-plans`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(Array.isArray(json.items)).toBe(true);
    expect(json.items.length).toBeGreaterThan(0);
  });

  test("/api/v1/me sem auth → 401", async ({ request }) => {
    const res = await request.get(`${WEB}/api/v1/me`);
    expect(res.status()).toBe(401);
  });

  test("status API → operational com dados frescos", async ({ request }) => {
    const res = await request.get(`${WEB}/api/public/status`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.services.length).toBeGreaterThanOrEqual(4);
    // observed_at deve ser recente (worker rodou) — não mais que 1 dia
    if (json.last_check) {
      const age = Date.now() - new Date(json.last_check).getTime();
      expect(age).toBeLessThan(24 * 60 * 60 * 1000);
    }
  });
});

test.describe("Produção — segurança (web)", () => {
  test("signin-password rejeita senha errada → 401", async ({ request }) => {
    const res = await request.post(`${WEB}/api/auth/signin-password`, {
      data: { email: LOGIN_EMAIL, password: "senha-errada-xyz" },
    });
    expect(res.status()).toBe(401);
  });

  test("signin-password aceita credenciais válidas → 200", async ({
    request,
  }) => {
    const res = await request.post(`${WEB}/api/auth/signin-password`, {
      data: { email: LOGIN_EMAIL, password: LOGIN_PASS },
    });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  test("security headers presentes", async ({ request }) => {
    const res = await request.get(`${WEB}/login`);
    const headers = res.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["strict-transport-security"]).toBeTruthy();
  });

  test("health-aggregator sem token → 401", async ({ request }) => {
    const res = await request.post(
      `${WEB}/api/internal/workers/monitoring/health-aggregator`,
    );
    expect(res.status()).toBe(401);
  });
});

test.describe("Produção — marketing", () => {
  test("landing / → 200", async ({ page }) => {
    const res = await page.goto(MARKETING);
    expect(res?.status()).toBe(200);
  });

  test("/precos renderiza planos", async ({ page }) => {
    await page.goto(`${MARKETING}/precos`);
    await expect(page.getByText(/planos transparentes/i)).toBeVisible();
    await expect(page.getByText(/14 dias gr/i).first()).toBeVisible();
  });

  test("/faq renderiza perguntas", async ({ page }) => {
    await page.goto(`${MARKETING}/faq`);
    await expect(
      page.getByRole("heading", { name: /perguntas frequentes/i }),
    ).toBeVisible();
  });

  test("sitemap.xml → 200 XML", async ({ request }) => {
    const res = await request.get(`${MARKETING}/sitemap.xml`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("<urlset");
    expect(body).toContain("/precos");
  });

  test("robots.txt bloqueia AI scrapers", async ({ request }) => {
    const res = await request.get(`${MARKETING}/robots.txt`);
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toContain("GPTBot");
  });
});

test.describe("Produção — patient PWA", () => {
  test("/login → 200", async ({ page }) => {
    const res = await page.goto(`${PATIENT}/login`);
    expect(res?.status()).toBe(200);
  });

  test("/app sem auth → redirect login", async ({ page }) => {
    await page.goto(`${PATIENT}/app`);
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("manifest.webmanifest válido", async ({ request }) => {
    const res = await request.get(`${PATIENT}/manifest.webmanifest`);
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toContain("NutriCore");
    expect(json.icons.length).toBeGreaterThan(0);
  });
});
