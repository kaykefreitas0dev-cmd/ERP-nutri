"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import Papa from "papaparse";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { appendAuditLog } from "@nutricore/db/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const PatientFieldSchema = z.object({
  fullName: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  cpf: z.string().nullable().optional(),
  birthDate: z.string().nullable().optional(),
  biologicalSex: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  occupation: z.string().nullable().optional(),
});

// CORREÇÃO QA #21 + #22: bloquear keys que causam prototype pollution.
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function safePick<T>(obj: Record<string, T>, key: string): T | undefined {
  if (FORBIDDEN_KEYS.has(key)) return undefined;
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

// CORREÇÃO QA #17: MIME types aceitos para CSV.
const ALLOWED_CSV_MIMES = new Set([
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel", // Excel salva CSV com esse type às vezes
  "text/plain", // fallback comum
]);

// Identificador para rate limit em Server Actions (sem request direto).
// Usa header x-forwarded-for via headers() helper do Next.js.
async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const xff = h.get("x-forwarded-for");
    if (xff) return xff.split(",")[0]?.trim() ?? "unknown";
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

interface UploadResult {
  ok: boolean;
  importId?: string;
  rows?: number;
  preview?: Record<string, string>[];
  headers?: string[];
  templates?: Array<{
    id: string;
    name: string;
    source: string;
    columnMapping: Record<string, string>;
  }>;
  message?: string;
}

export async function uploadImportFileAction(
  formData: FormData,
): Promise<UploadResult> {
  // CORREÇÃO QA #20: rate limit per-IP — 5 uploads / 10min.
  // Server Actions não recebem req direto; usamos headers() do Next.js.
  const ip = await getClientIp();
  // Faux request para o helper (só usa .headers.get + .cookies.get)
  const fauxReq = {
    headers: { get: (_: string) => null },
    cookies: { get: () => undefined },
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const limit = await checkRateLimit(fauxReq as any, "imports:upload", {
    max: 5,
    windowSec: 600,
    identifier: ip,
  });
  if (!limit.ok) {
    return { ok: false, message: "Muitos uploads. Aguarde alguns minutos." };
  }

  const file = formData.get("file");
  const source = formData.get("source") as string | null;
  if (!file || !(file instanceof File)) {
    return { ok: false, message: "Arquivo obrigatório" };
  }
  if (!source || !["dietbox", "webdiet", "custom_csv"].includes(source)) {
    return { ok: false, message: "Source inválido" };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, message: "Arquivo > 10MB. Divida em partes menores." };
  }
  if (file.size === 0) {
    return { ok: false, message: "Arquivo vazio" };
  }
  // CORREÇÃO QA #17: validar MIME type + extensão.
  // Cliente pode forjar MIME, mas combinado com extensão dá camada extra.
  if (file.type && !ALLOWED_CSV_MIMES.has(file.type)) {
    return {
      ok: false,
      message: `Tipo de arquivo não suportado (${file.type}). Use .csv`,
    };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { ok: false, message: "Apenas arquivos .csv são aceitos" };
  }

  const text = await file.text();
  // Tenta detectar encoding (UTF-8 BOM, depois Latin-1 fallback)
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.errors[0]?.type === "Delimiter") {
    return {
      ok: false,
      message:
        "Não foi possível detectar o delimitador. Salve o arquivo como CSV vírgula.",
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { ok: false, message: "Arquivo vazio ou sem linhas válidas" };
  }
  // CORREÇÃO QA #25: limite de linhas (DoS + memory exhaustion).
  if (rows.length > 5000) {
    return {
      ok: false,
      message: `Arquivo tem ${rows.length} linhas. Limite por importação: 5000.`,
    };
  }

  const headersList = parsed.meta.fields ?? [];

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const dataImport = await tx.dataImport.create({
          data: {
            organizationId,
            userId,
            source,
            entityType: "patient",
            originalFileName: file.name,
            fileSizeBytes: file.size,
            encoding: "utf-8",
            status: "MAPPING",
            totalRows: rows.length,
          },
        });

        // Templates disponíveis para esta source
        const templates = await tx.importTemplate.findMany({
          where: {
            source,
            entityType: "patient",
            OR: [{ organizationId: null }, { organizationId }],
          },
          select: {
            id: true,
            name: true,
            source: true,
            columnMapping: true,
          },
        });

        return { importId: dataImport.id, templates };
      },
    );

    return {
      ok: true,
      importId: result.importId,
      rows: rows.length,
      preview: rows.slice(0, 5),
      headers: headersList,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      templates: (result.templates as any[]).map((t) => ({
        id: t.id as string,
        name: t.name as string,
        source: t.source as string,
        columnMapping: t.columnMapping as Record<string, string>,
      })),
    };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[imports/upload]", err);
    return { ok: false, message: "Erro ao processar arquivo" };
  }
}

interface ConfirmImportInput {
  importId: string;
  columnMapping: Record<string, string>;
  csvContent: string; // re-enviado pelo cliente (não persistimos arquivo entre passos no MVP)
}

interface ProcessResult {
  ok: boolean;
  processed?: number;
  errors?: number;
  message?: string;
}

// CORREÇÃO QA #19 (parcial): validar importId é UUID válido.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function confirmImportAction(
  input: ConfirmImportInput,
): Promise<ProcessResult> {
  if (!input.importId || !UUID_REGEX.test(input.importId)) {
    return { ok: false, message: "importId inválido" };
  }
  if (!input.csvContent || typeof input.csvContent !== "string") {
    return { ok: false, message: "Dados incompletos" };
  }
  // CORREÇÃO QA #25: limite de payload (cliente reenvia CSV, abusivo).
  if (input.csvContent.length > 15 * 1024 * 1024) {
    return { ok: false, message: "Payload CSV > 15MB" };
  }

  // CORREÇÃO QA #21 + #22: validar columnMapping não contém keys perigosas.
  if (!input.columnMapping || typeof input.columnMapping !== "object") {
    return { ok: false, message: "Mapeamento inválido" };
  }
  for (const k of Object.keys(input.columnMapping)) {
    if (FORBIDDEN_KEYS.has(k)) {
      return { ok: false, message: "Mapeamento contém chave reservada" };
    }
    const v = input.columnMapping[k];
    if (typeof v !== "string" || FORBIDDEN_KEYS.has(v)) {
      return {
        ok: false,
        message: "Mapeamento contém valor inválido ou reservado",
      };
    }
  }

  // Validate mapping has at least fullName
  const targetFields = Object.values(input.columnMapping);
  if (!targetFields.includes("fullName")) {
    return {
      ok: false,
      message: 'Mapeie pelo menos a coluna "fullName" (Nome completo)',
    };
  }

  const cleaned =
    input.csvContent.charCodeAt(0) === 0xfeff
      ? input.csvContent.slice(1)
      : input.csvContent;
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data;
  if (rows.length > 5000) {
    return { ok: false, message: "Limite 5000 linhas por importação" };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #19: validar importId é desta org ANTES de update.
        // RLS deveria garantir, mas explicit check é defense-in-depth.
        const existingImport = await tx.dataImport.findFirst({
          where: { id: input.importId, organizationId },
          select: { id: true, status: true },
        });
        if (!existingImport) {
          throw new Error("Import não encontrado nesta organização");
        }
        if (
          existingImport.status === "COMPLETED" ||
          existingImport.status === "FAILED"
        ) {
          throw new Error("Import já foi processado");
        }

        await tx.dataImport.update({
          where: { id: input.importId },
          data: {
            status: "PROCESSING",
            startedAt: new Date(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            columnMapping: input.columnMapping as any,
          },
        });

        let processed = 0;
        let errorCount = 0;
        const errorList: Array<{ row: number; error: string }> = [];

        for (let i = 0; i < rows.length; i++) {
          const csvRow = rows[i]!;
          try {
            // CORREÇÃO QA #21 + #22: usar Object.create(null) elimina __proto__.
            // safePick filtra acesso a chaves proibidas no csvRow.
            const mapped: Record<string, string | null> = Object.create(null);
            for (const [csvCol, targetField] of Object.entries(
              input.columnMapping,
            )) {
              if (FORBIDDEN_KEYS.has(targetField)) continue;
              const rawValue = safePick(csvRow, csvCol);
              const v = rawValue?.trim();
              mapped[targetField] = v && v.length > 0 ? v : null;
            }

            // biologicalSex normalization (mapeamento comum BR)
            if (mapped.biologicalSex) {
              const s = mapped.biologicalSex.toLowerCase();
              if (s === "f" || s === "feminino" || s === "female")
                mapped.biologicalSex = "female";
              else if (s === "m" || s === "masculino" || s === "male")
                mapped.biologicalSex = "male";
              else mapped.biologicalSex = null;
            }

            // birthDate normalization (DD/MM/YYYY -> ISO)
            if (mapped.birthDate) {
              const m = mapped.birthDate.match(
                /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
              );
              if (m) {
                mapped.birthDate = `${m[3]}-${m[2]?.padStart(2, "0")}-${m[1]?.padStart(2, "0")}`;
              }
            }

            const validated = PatientFieldSchema.safeParse({
              fullName: mapped.fullName,
              email: mapped.email,
              phone: mapped.phone,
              cpf: mapped.cpf,
              birthDate: mapped.birthDate,
              biologicalSex: mapped.biologicalSex,
              city: mapped.city,
              state: mapped.state?.toUpperCase(),
              occupation: mapped.occupation,
            });

            if (!validated.success) {
              errorCount++;
              if (errorList.length < 50) {
                // CORREÇÃO QA #23: log SÓ os campos com erro, não os valores
                // (que podem conter PII como CPF/email do paciente).
                errorList.push({
                  row: i + 1,
                  error: Object.keys(
                    validated.error.flatten().fieldErrors,
                  ).join(", "),
                });
              }
              continue;
            }

            await tx.patient.create({
              data: {
                organizationId,
                primaryNutritionistId: userId,
                fullName: validated.data.fullName,
                email: validated.data.email,
                phone: validated.data.phone,
                cpf: validated.data.cpf,
                birthDate: validated.data.birthDate
                  ? new Date(validated.data.birthDate)
                  : null,
                biologicalSex: validated.data.biologicalSex,
                city: validated.data.city,
                state: validated.data.state,
                occupation: validated.data.occupation,
                importedFromId: input.importId,
                status: "ACTIVE",
              },
            });
            processed++;
          } catch (e) {
            errorCount++;
            if (errorList.length < 50) {
              // CORREÇÃO QA #23: error message pode vazar PII.
              // Logar apenas o tipo do erro (sanitizado).
              const safeMessage =
                e instanceof Error
                  ? e.name === "PrismaClientKnownRequestError"
                    ? "DB constraint violation"
                    : e.name
                  : "Unknown error";
              errorList.push({ row: i + 1, error: safeMessage });
            }
          }
        }

        await tx.dataImport.update({
          where: { id: input.importId },
          data: {
            status: "COMPLETED",
            completedAt: new Date(),
            processedRows: processed,
            errorRows: errorCount,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            errors: errorList as any,
          },
        });

        // CORREÇÃO QA #24: usar appendAuditLog helper que faz parameter
        // binding correto de arrays Postgres (vs raw template).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "data_import.completed",
          entityType: "DataImport",
          entityId: input.importId,
          patientId: null,
          fieldsAccessed: ["source", "total", "processed", "errors"],
          payload: { processed, errorCount, totalRows: rows.length },
        });

        return { processed, errors: errorCount };
      },
    );

    revalidatePath("/app/patients");
    revalidatePath("/app/imports");
    return { ok: true, ...result };
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return { ok: false, message: err.message };
    }
    console.error("[imports/confirm]", err);
    return { ok: false, message: "Erro ao processar import" };
  }
}
