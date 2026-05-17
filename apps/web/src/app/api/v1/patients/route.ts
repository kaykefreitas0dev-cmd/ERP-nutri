// GET /api/v1/patients — Mobile-ready REST (Lock 11)
// POST /api/v1/patients — criar paciente

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant, TenantContextError } from "@nutricore/db/with-tenant";

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
    const q = url.searchParams.get("q");
    const status =
      (url.searchParams.get("status") as
        | "ACTIVE"
        | "ARCHIVED"
        | "ANONYMIZED") ?? "ACTIVE";
    const take = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);

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
        take,
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

      await prisma.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'patient.create'::text, 'Patient'::text,
          ${created.id}::text, ${created.id}::uuid,
          ARRAY['fullName','email','phone']::text[],
          '{}'::jsonb
        )
      `;

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
