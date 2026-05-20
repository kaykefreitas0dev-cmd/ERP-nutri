/**
 * A11y (Accessibility) — axe-core checks on key pages.
 *
 * Tests public pages without auth + authenticated pages via session reuse.
 * Uses @axe-core/playwright: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright
 *
 * WCAG 2.1 AA target (ADR 0011 / §11 Quality Standards).
 *
 * Pre-req: dev server running at :3000 OR WEB_BASE_URL env var set to preview URL.
 */
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/* ── shared session for authenticated tests ───────────────────── */

const ADMIN_EMAIL = "admin@nutricore.app";
const ADMIN_PASS = "Nutri@2026Test!";

let authedPage: Page | null = null;

/** Fails violations that are impact=serious|critical (not minor/moderate) */
const STRICT_IMPACT = ["critical", "serious"] as const;

async function checkA11y(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();

  const criticalViolations = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );

  if (criticalViolations.length > 0) {
    const report = criticalViolations
      .map(
        (v) =>
          `[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n  Nodes: ${v.nodes.map((n) => n.target).join(", ")}`,
      )
      .join("\n\n");
    console.error(
      `[a11y] ${label} — ${criticalViolations.length} violations:\n${report}`,
    );
  }

  expect(
    criticalViolations,
    `${label} has ${criticalViolations.length} critical/serious a11y violations`,
  ).toHaveLength(0);
}

/* ── public pages (no auth) ───────────────────────────────────── */

test.describe("A11y — public pages", () => {
  test("login page — WCAG 2.1 AA", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await checkA11y(page, "Login page");
  });

  // Marketing home — only if WEB_BASE_URL points to full deployment with marketing
  test("marketing home — WCAG 2.1 AA", async ({ page }) => {
    // Try to hit the root; if it's the web app it redirects, skip gracefully
    const response = await page.goto("/", { waitUntil: "domcontentloaded" });
    if (
      !response ||
      page.url().includes("/login") ||
      page.url().includes("/app")
    ) {
      test.skip(
        true,
        "Root redirects — no standalone marketing home in this deployment",
      );
    }
    await page.waitForLoadState("networkidle");
    await checkA11y(page, "Marketing home");
  });
});

/* ── authenticated pages ──────────────────────────────────────── */

test.describe("A11y — authenticated pages (serial)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    authedPage = await ctx.newPage();

    await authedPage.goto("/login");
    await authedPage.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
    await authedPage.getByLabel(/senha/i).fill(ADMIN_PASS);
    await authedPage.getByRole("button", { name: /^entrar$/i }).click();

    const targetUrl = await authedPage.waitForURL(/\/(app|onboarding)/, {
      timeout: 15_000,
    });
    void targetUrl;

    if (authedPage.url().includes("/onboarding")) {
      authedPage = null; // Sem org — skip todos os testes autenticados
    }
  });

  test.afterAll(async () => {
    await authedPage?.context().close();
    authedPage = null;
  });

  test("dashboard /app — WCAG 2.1 AA", async () => {
    if (!authedPage) test.skip(true, "Sem org — complete onboarding primeiro");
    await authedPage!.goto("/app");
    await authedPage!.waitForLoadState("networkidle");
    await checkA11y(authedPage!, "Dashboard /app");
  });

  test("patients list /app/patients — WCAG 2.1 AA", async () => {
    if (!authedPage) test.skip(true, "Sem org — complete onboarding primeiro");
    await authedPage!.goto("/app/patients");
    await authedPage!.waitForLoadState("networkidle");
    await checkA11y(authedPage!, "Patients list");
  });

  test("agenda /app/agenda — WCAG 2.1 AA", async () => {
    if (!authedPage) test.skip(true, "Sem org — complete onboarding primeiro");
    await authedPage!.goto("/app/agenda");
    await authedPage!.waitForLoadState("networkidle");
    await checkA11y(authedPage!, "Agenda");
  });

  test("settings /app/settings — WCAG 2.1 AA", async () => {
    if (!authedPage) test.skip(true, "Sem org — complete onboarding primeiro");
    await authedPage!.goto("/app/settings");
    await authedPage!.waitForLoadState("networkidle");
    await checkA11y(authedPage!, "Settings");
  });
});
