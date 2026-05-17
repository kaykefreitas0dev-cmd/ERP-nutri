/**
 * Smoke test do fluxo paciente end-to-end.
 *
 * Fluxo realista — sem chamar Supabase Auth (que requer email real):
 *   1. Nutri cria paciente
 *   2. Nutri gera invite → captura URL
 *   3. Spider checa landing /invite/[token] sem auth (deve mostrar formulário)
 *   4. Nutri concluir consulta com pagamento → recibo gerado
 *
 * Patient app real (apps/patient) é coberto apenas pelo healthcheck — não
 * tem como simular magic-link de auth sem real email + token Supabase.
 *
 * Pre-req: dev server em :3000 e :3002.
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@nutricore.app";
const ADMIN_PASS = "Nutri@2026Test!";
const PATIENT_APP_BASE =
  process.env.PATIENT_BASE_URL ?? "http://localhost:3002";

const RUN_ID = Date.now().toString(36);
const PATIENT_NAME = `E2E Invite ${RUN_ID}`;
const PATIENT_EMAIL = `e2e-invite-${RUN_ID}@test.local`;
const PATIENT_CPF = generateCpf();

let patientUrl = "";
let inviteUrl = "";

test.describe.configure({ mode: "serial" });

test.describe("Patient smoke flow (cross-app)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    // Login uma vez
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASS);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 15_000 });
    if (page.url().includes("/onboarding")) {
      test.skip(true, "Sem org criada");
    }
  });

  test("1. Criar paciente pra gerar invite", async () => {
    await page.goto("/app/patients/new");
    await page.getByLabel(/nome completo/i).fill(PATIENT_NAME);
    await page.getByLabel(/email/i).first().fill(PATIENT_EMAIL);
    await page.getByLabel(/cpf/i).fill(PATIENT_CPF);
    await page
      .getByRole("button", { name: /salvar|criar/i })
      .first()
      .click();
    await page.waitForURL(/\/app\/patients\/[a-f0-9-]+$/, { timeout: 10_000 });
    patientUrl = page.url();
  });

  test("2. Gerar convite e capturar URL", async () => {
    await page.goto(patientUrl);
    // Clica botão "Convidar para acessar app"
    const inviteBtn = page.getByRole("button", {
      name: /convidar para acessar app/i,
    });
    await inviteBtn.click();
    // Email já vem pre-filled do paciente
    const sendBtn = page.getByRole("button", { name: /enviar convite/i });
    await sendBtn.click();
    // Aguarda link aparecer
    const linkInput = page.locator("input[readonly]").first();
    await expect(linkInput).toBeVisible({ timeout: 15_000 });
    inviteUrl = (await linkInput.inputValue()).trim();
    expect(inviteUrl).toMatch(/\/invite\//);
    // URL DEVE apontar pra localhost:3002 (NÃO pra default produção)
    expect(inviteUrl).toContain("localhost:3002");
  });

  test("3. Patient app responde no /invite/[token]", async ({ browser }) => {
    // Abre em context separado (sem auth do nutri)
    const ctx = await browser.newContext();
    const pp = await ctx.newPage();
    const resp = await pp.goto(inviteUrl, { waitUntil: "domcontentloaded" });
    expect(resp?.status()).toBeLessThan(400);
    // Tela tem heading "Olá, X" (primeiro nome) + form de aceite
    await expect(pp.getByRole("heading", { name: /Olá,/ })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      pp.getByRole("button", { name: /aceitar convite/i }),
    ).toBeVisible();
    // Email do paciente está pre-filled
    const emailInput = pp.locator('input[type="email"]').first();
    await expect(emailInput).toHaveValue(PATIENT_EMAIL);
    await ctx.close();
  });

  test("4. Agenda página acessível", async () => {
    // O fluxo completo "criar consulta -> concluir -> recibo" envolve form
    // complexo (selecionar paciente em combobox, data/hora, modal de
    // pagamento) que é melhor cobrir com test dedicado. Aqui apenas valida
    // que a página de agenda carrega + form de criar está visível.
    await page.goto("/app/agenda");
    // Heading é uma data (ex: "domingo, 17 de maio de 2026") + "Nova consulta"
    await expect(
      page.getByRole("heading", { name: /nova consulta/i }),
    ).toBeVisible();
    // Form de criar appointment deve estar presente
    await expect(page.locator('input[name="startsAt"]').first()).toBeVisible();
  });

  test("5. Financeiro acessível com filtros", async () => {
    await page.goto("/app/financeiro");
    await expect(
      page.getByRole("heading", { name: /financeiro/i }),
    ).toBeVisible();
    // KPI principal visível
    await expect(page.getByText(/total no período/i)).toBeVisible();
    // Filtro de método
    await expect(page.locator('select[name="method"]')).toBeVisible();
  });

  test("6. Patient app login page responde", async ({ browser }) => {
    const ctx = await browser.newContext();
    const pp = await ctx.newPage();
    const resp = await pp.goto(`${PATIENT_APP_BASE}/login`);
    expect(resp?.status()).toBeLessThan(400);
    await expect(pp.getByText(/NutriCore/i).first()).toBeVisible();
    await ctx.close();
  });
});

function generateCpf(): string {
  const n = () => Math.floor(Math.random() * 10);
  const digits: number[] = [];
  for (let i = 0; i < 9; i++) digits.push(n());
  for (let j = 0; j < 2; j++) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += digits[i]! * (digits.length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    digits.push(rest === 10 ? 0 : rest);
  }
  const s = digits.join("");
  return `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
}
