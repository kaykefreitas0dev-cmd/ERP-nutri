/**
 * Smoke test do fluxo nutri end-to-end em UM browser session (realista).
 *
 * Cobre: login → dashboard → criar paciente → meal plan → documento → recibo via agenda.
 * Reusa o user `admin@nutricore.app` criado via admin API.
 *
 * Pre-req: dev server rodando em :3000.
 */
import { test, expect, type Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@nutricore.app";
const ADMIN_PASS = "Nutri@2026Test!";

// Estado compartilhado entre steps (testes serial)
const RUN_ID = Date.now().toString(36);
const PATIENT_NAME = `E2E Patient ${RUN_ID}`;
const PATIENT_EMAIL = `e2e-${RUN_ID}@test.local`;
const PATIENT_CPF = generateCpf();

let patientUrl = ""; // populado no step "Criar paciente"

test.describe.configure({ mode: "serial" });

test.describe("Nutri smoke flow (single session)", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
  });

  test("1. Login com email + senha", async () => {
    await page.goto("/login");
    await page.getByLabel(/email/i).first().fill(ADMIN_EMAIL);
    await page.getByLabel(/senha/i).fill(ADMIN_PASS);
    await page.getByRole("button", { name: /^entrar$/i }).click();
    await page.waitForURL(/\/(app|onboarding)/, { timeout: 15_000 });
  });

  test("2. Dashboard mostra KPIs", async () => {
    if (page.url().includes("/onboarding")) {
      test.skip(
        true,
        "Sem org criada — complete onboarding manualmente primeiro",
      );
    }
    await page.goto("/app");
    await expect(page.getByText(/pacientes ativos/i)).toBeVisible();
    await expect(page.getByText(/receita do mês/i)).toBeVisible();
  });

  test("3. Criar paciente novo", async () => {
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
    await expect(
      page.getByRole("heading", { name: PATIENT_NAME }),
    ).toBeVisible();
  });

  test("4. Patient aparece na listagem", async () => {
    await page.goto("/app/patients");
    await expect(page.getByText(PATIENT_NAME)).toBeVisible({ timeout: 5_000 });
  });

  test("5. Criar meal plan e abrir editor", async () => {
    await page.goto(`${patientUrl}/meal-plans`);
    await page.getByLabel(/nome do plano/i).fill(`Plano ${RUN_ID}`);
    // Adiciona targetKcal pra evitar qualquer corner case do form
    const kcalInput = page.getByLabel(/meta kcal/i);
    if (await kcalInput.count()) await kcalInput.fill("2000");
    await page.getByRole("button", { name: /criar plano/i }).click();
    await page.waitForURL(/\/meal-plans\/[a-f0-9-]+$/, { timeout: 15_000 });
    // Deve mostrar dias/refeições default
    await expect(page.getByText(/café da manhã|almoço/i).first()).toBeVisible();
  });

  test("6. Documentos: criar e visualizar atestado DRAFT", async () => {
    await page.goto(`${patientUrl}/documents`);
    // Botão "+ Novo documento"
    const newDocLink = page.getByRole("link", { name: /\+\s*novo documento/i });
    await newDocLink.click();
    await page.waitForURL(/\/documents\/new$/);
    // Tipo "Atestado" já vem default; título e body também (template autofill)
    await page.getByRole("button", { name: /salvar como rascunho/i }).click();
    await page.waitForURL(/\/documents\/[a-f0-9-]+$/, { timeout: 10_000 });
    // Badge DRAFT
    await expect(page.getByText("DRAFT").first()).toBeVisible();
  });

  test("7. Financeiro acessível", async () => {
    await page.goto("/app/financeiro");
    await expect(
      page.getByRole("heading", { name: /financeiro/i }),
    ).toBeVisible();
    // Mostra ao menos "Total no período" KPI
    await expect(page.getByText(/total no período/i)).toBeVisible();
  });

  test("8. Agenda — day view carrega e formulário visível", async () => {
    await page.goto("/app/agenda");
    // Heading da página de agenda
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 8_000,
    });
    // Formulário "Nova consulta" deve estar visível (day view padrão)
    await expect(
      page.getByRole("heading", { name: /nova consulta/i }),
    ).toBeVisible();
    // Campo de data e hora existe
    await expect(page.getByLabel(/data e hora/i)).toBeVisible();
  });

  test("9. Agenda — criar consulta para o paciente do teste", async () => {
    // Navega para agenda com deep-link para o paciente criado no step 3
    const patientId = patientUrl.split("/").at(-1)!;
    await page.goto(`/app/agenda?patientId=${patientId}`);

    // O chip com o primeiro nome do paciente deve aparecer no formulário
    const firstName = PATIENT_NAME.split(" ")[0]!;
    await expect(
      page.getByText(firstName, { exact: false }).first(),
    ).toBeVisible({
      timeout: 8_000,
    });

    // Preenche duração e faz submit
    await page.getByLabel(/duração/i).selectOption("30");
    await page.getByRole("button", { name: /agendar consulta/i }).click();

    // Após agendar, o paciente aparece na lista de consultas (pode levar um refresh)
    await page.waitForTimeout(1_500);
    await expect(page.getByText(PATIENT_NAME, { exact: false })).toBeVisible({
      timeout: 8_000,
    });
  });

  test("10. Agenda — lista mostra botão Confirmar na consulta criada", async () => {
    await page.goto("/app/agenda");
    // A consulta do step 9 deve estar visível com status SCHEDULED
    await expect(page.getByText(PATIENT_NAME, { exact: false })).toBeVisible({
      timeout: 8_000,
    });
    // Botão "Confirmar" (status SCHEDULED) deve estar presente
    await expect(
      page.getByRole("button", { name: /^confirmar$/i }).first(),
    ).toBeVisible();
  });
});

// CPF válido aleatório (módulo 11)
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
