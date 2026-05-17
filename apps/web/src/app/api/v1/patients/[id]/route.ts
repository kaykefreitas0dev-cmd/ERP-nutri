// GET /api/v1/patients/:id — detalhe paciente
// PATCH /api/v1/patients/:id — update parcial

import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withTenant, TenantContextError } from "@nutricore/db/with-tenant";

const UpdatePatientSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  preferredName: z.string().max(60).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  cpf: z.string().max(14).nullable().optional(),
  birthDate: z.string().nullable().optional(),
  biologicalSex: z.enum(["female", "male", "intersex", "undisclosed"]).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  state: z.string().length(2).nullable().optional(),
  occupation: z.string().max(120).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  try {
    return await withTenant(req, async ({ prisma, organizationId, userId }) => {
      const patient = await prisma.patient.findFirst({
        where: { id },
        include: {
          allergies: { include: { allergen: { select: { name: true, slug: true } } } },
          clinicalConditions: true,
          dietaryRestrictions: true,
        },
      });

      if (!patient) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      // Audit PHI read
      await prisma.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'patient.read'::text, 'Patient'::text,
          ${patient.id}::text, ${patient.id}::uuid,
          ARRAY['fullName','email','phone','cpf']::text[],
          '{}'::jsonb
        )
      `;

      return NextResponse.json(
        { patient },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    });
  } catch (err) {
    if (err instanceof TenantContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/v1/patients/:id GET]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;

  try {
    const body = await req.json();
    const parsed = UpdatePatientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    return await withTenant(req, async ({ prisma, organizationId, userId }) => {
      const data = parsed.data;
      const updated = await prisma.patient.update({
        where: { id },
        data: {
          ...data,
          birthDate: data.birthDate ? new Date(data.birthDate) : data.birthDate as null | undefined,
        },
      });

      await prisma.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'patient.update'::text, 'Patient'::text,
          ${updated.id}::text, ${updated.id}::uuid,
          ${Object.keys(data)}::text[],
          '{}'::jsonb
        )
      `;

      return NextResponse.json({ patient: updated });
    });
  } catch (err) {
    if (err instanceof TenantContextError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[/v1/patients/:id PATCH]", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
