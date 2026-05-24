// GET /api/v1/patients — Mobile-ready REST (Lock 11)
// POST /api/v1/patients — criar paciente
//
// CORREÇÃO QA #3, #4, #5:
//   #3 — `Number(limit)` virava NaN com input inválido → Prisma erro 500.
//        Agora validado via Zod com fallback e clamp.
//   #4 — `as` cast de status sem validação → 500 com enum inválido.
//        Agora validado via Zod enum.
//   #5 — `Object.keys(data)` em $executeRaw serializava como JSON, não array
//        Postgres. Substituído por appendAuditLog helper que faz binding correto.

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant, TenantContextError } from "@nutricore/db/with-tenant";
import { appendAuditLog } from "@nutricore/db/audit";

// CORREÇÃO QA #3 + #4: query params validados com Zod (não com cast).
const ListQuerySchema = z.object({
  q: z
    .string()
    .min(1)
    .max(120)
    .optional()
    .transform((v) => v?.trim()),
  status: z.enum(["ACTIVE", "ARCHIVED", "ANONYMIZED"]).default("ACTIVE"),
  // coerce.number + clamp + safe-default. limit=abc → 50 (sem NaN).
  limit: z.coerce.number().int().min(1).max(200).default(50).catch(50),
});

const CreatePatientSchema = z.object({
  fullName: z.string().min(2).max(120).trim(),
  preferredName: z.string().max(60).optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  phone: z.string().max(40).optional(),
  cpf: z.string().max(14).optional(),
  birthDate: z.string().optional(),
  biologicalSex: z
    .enum(["female", "male", "intersex", "undisclosed"])
    .optional(),
  city: z.string().max(120).optional(),
  state: z.string().length(2).optional(),
  occupation: z.string().max(120).optional(),
  notes: z.string().max(2000).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<Response> {
  try {
    const url = new URL(req.url);
    const queryParsed = ListQuerySchema.safeParse({
      q: url.searchParams.get("q") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: queryParsed.error.flatten() },
        { status: 400 },
      );
    }
    const { q, status, limit } = queryParsed.data;

    return await withTenant(req, async ({ prisma }) => {
      const patients = await prisma.patient.findMany({
        where: {
          status,
          ...(q
            ? {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        orderBy: { updatedAt: "desc" },
        take: limit,
        select: {
          id: true,
          fullName: true,
          preferredName: true,
          email: true,
          phone: true,
          status: true,
          updatedAt: true,
          createdAt: true,
        },
      });

      return NextResponse.json(
        { items: patients, count: patients.length },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    });
  } catch (err) {
    if (err instanceof TenantContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/v1/patients GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  try {
    const body = await req.json();
    const parsed = CreatePatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    return await withTenant(req, async ({ prisma, organizationId, userId }) => {
      const created = await prisma.patient.create({
        data: {
          organizationId,
          primaryNutritionistId: userId,
          fullName: data.fullName,
          preferredName: data.preferredName ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          cpf: data.cpf ?? null,
          birthDate: data.birthDate ? new Date(data.birthDate) : null,
          biologicalSex: data.biologicalSex ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          occupation: data.occupation ?? null,
          notes: data.notes ?? null,
          status: "ACTIVE",
        },
      });

      // CORREÇÃO QA #5: appendAuditLog usa $queryRaw com binding correto
      // de arrays Postgres em vez de Object.keys() interpolado.
      await appendAuditLog({
        organizationId,
        actorUserId: userId,
        actorRole: "nutritionist",
        action: "patient.create",
        entityType: "Patient",
        entityId: created.id,
        patientId: created.id,
        fieldsAccessed: ["fullName", "email", "phone"],
        payload: {},
      });

      return NextResponse.json({ patient: created }, { status: 201 });
    });
  } catch (err) {
    if (err instanceof TenantContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/v1/patients POST]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
