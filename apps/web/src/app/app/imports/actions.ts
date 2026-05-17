"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import Papa from "papaparse";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

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

export async function uploadImportFileAction(formData: FormData): Promise<UploadResult> {
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
      message: "Não foi possível detectar o delimitador. Salve o arquivo como CSV vírgula.",
    };
  }

  const rows = parsed.data;
  if (rows.length === 0) {
    return { ok: false, message: "Arquivo vazio ou sem linhas válidas" };
  }

  const headers = parsed.meta.fields ?? [];

  try {
    const result = await withTenantAction(async ({ tx, organizationId, userId }) => {
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
    });

    return {
      ok: true,
      importId: result.importId,
      rows: rows.length,
      preview: rows.slice(0, 5),
      headers,
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

export async function confirmImportAction(input: ConfirmImportInput): Promise<ProcessResult> {
  if (!input.importId || !input.csvContent) {
    return { ok: false, message: "Dados incompletos" };
  }

  // Validate mapping has at least fullName
  const targetFields = Object.values(input.columnMapping);
  if (!targetFields.includes("fullName")) {
    return { ok: false, message: 'Mapeie pelo menos a coluna "fullName" (Nome completo)' };
  }

  const cleaned =
    input.csvContent.charCodeAt(0) === 0xfeff ? input.csvContent.slice(1) : input.csvContent;
  const parsed = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const rows = parsed.data;

  try {
    const result = await withTenantAction(async ({ tx, organizationId, userId }) => {
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
          // Apply mapping: csv_col -> schema_field
          const mapped: Record<string, string | null> = {};
          for (const [csvCol, targetField] of Object.entries(input.columnMapping)) {
            const v = csvRow[csvCol]?.trim();
            mapped[targetField] = v && v.length > 0 ? v : null;
          }

          // biologicalSex normalization (mapeamento comum BR)
          if (mapped.biologicalSex) {
            const s = mapped.biologicalSex.toLowerCase();
            if (s === "f" || s === "feminino" || s === "female") mapped.biologicalSex = "female";
            else if (s === "m" || s === "masculino" || s === "male")
              mapped.biologicalSex = "male";
            else mapped.biologicalSex = null;
          }

          // birthDate normalization (DD/MM/YYYY -> ISO)
          if (mapped.birthDate) {
            const m = mapped.birthDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
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
              errorList.push({
                row: i + 1,
                error: Object.entries(validated.error.flatten().fieldErrors)
                  .map(([k, v]) => `${k}: ${v?.join(",")}`)
                  .join("; "),
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
              birthDate: validated.data.birthDate ? new Date(validated.data.birthDate) : null,
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
            errorList.push({ row: i + 1, error: e instanceof Error ? e.message : "?" });
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

      // Audit
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'data_import.completed'::text, 'DataImport'::text,
          ${input.importId}::text, NULL::uuid,
          ARRAY['source','total','processed','errors']::text[],
          ${JSON.stringify({ processed, errorCount })}::jsonb
        )
      `;

      return { processed, errors: errorCount };
    });

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
