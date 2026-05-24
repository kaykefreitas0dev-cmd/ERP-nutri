/**
 * GET /api/v1/meal-plans/[planId]/pdf
 *
 * Gera e serve o PDF do plano alimentar on-the-fly.
 * Tenant-aware via withTenantAction.
 * runtime = "nodejs" — pdfkit precisa de fs.
 */

import { NextRequest, NextResponse } from "next/server";
// CORREÇÃO QA Rodada 6: appendAuditLog helper.
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { renderMealPlanPdf } from "@/lib/pdf/meal-plan-pdf";
import { appendAuditLog } from "@nutricore/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ planId: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { planId } = await params;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // 1. Carregar plano (RLS garante que pertence ao tenant)
        const plan = await tx.mealPlan.findFirst({
          where: { id: planId },
          include: {
            patient: { select: { fullName: true, cpf: true } },
            days: {
              orderBy: { sortOrder: "asc" },
              include: {
                meals: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    items: {
                      orderBy: { sortOrder: "asc" },
                      include: {
                        food: { select: { name: true } },
                      },
                    },
                  },
                },
              },
            },
          },
        });
        if (!plan) return null;

        // 2. Dados do profissional (nome + CRN)
        const [user, bookingPage] = await Promise.all([
          tx.user.findUnique({
            where: { id: userId },
            select: { fullName: true },
          }),
          tx.bookingPage.findFirst({
            where: { professionalUserId: userId, organizationId },
            select: { displayName: true, crn: true, crnUf: true },
          }),
        ]);

        const issuerName =
          bookingPage?.displayName ?? user?.fullName ?? "Nutricionista";
        const issuerCrn = bookingPage?.crn ?? null;
        const issuerCrnUf = bookingPage?.crnUf ?? null;

        // CORREÇÃO QA #87: appendAuditLog helper (read PHI = audit detalhado).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "meal_plan.pdf_download",
          entityType: "MealPlan",
          entityId: plan.id,
          patientId: plan.patientId,
          fieldsAccessed: ["days", "meals", "items"],
          payload: {},
        });

        return { plan, issuerName, issuerCrn, issuerCrnUf };
      },
    );

    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    const { plan, issuerName, issuerCrn, issuerCrnUf } = result;

    // 4. Construir payload tipado para o renderer
    // `tx` é `any` — precisamos anotar explicitamente a forma dos days do Prisma
    type RawItem = {
      food: { name: string };
      quantityG: unknown;
      kcal: unknown;
      proteinG: unknown;
      carbG: unknown;
      fatG: unknown;
      preparationNotes: string | null;
    };
    type RawMeal = {
      name: string;
      scheduledTime: string | null;
      items: RawItem[];
    };
    type RawDay = { dayLabel: string; meals: RawMeal[] };

    const pdfDays = (plan.days as RawDay[]).map((day) => ({
      dayLabel: day.dayLabel,
      meals: day.meals.map((meal) => ({
        name: meal.name,
        scheduledTime: meal.scheduledTime,
        items: meal.items.map((item) => ({
          foodName: item.food.name,
          quantityG: Number(item.quantityG),
          kcal: item.kcal != null ? Number(item.kcal) : null,
          proteinG: item.proteinG != null ? Number(item.proteinG) : null,
          carbG: item.carbG != null ? Number(item.carbG) : null,
          fatG: item.fatG != null ? Number(item.fatG) : null,
          preparationNotes: item.preparationNotes,
        })),
      })),
    }));

    const buffer = await renderMealPlanPdf({
      planName: plan.name,
      issuerName,
      issuerCrn,
      issuerCrnUf,
      patientName: plan.patient.fullName,
      patientCpf: plan.patient.cpf ?? null,
      generatedAt: new Date(),
      days: pdfDays,
    });

    const filename = slugify(`plano-alimentar-${plan.name}`) + ".pdf";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    return NextResponse.json(
      {
        error: "internal",
        message: err instanceof Error ? err.message : "Erro inesperado",
      },
      { status: 500 },
    );
  }
}

function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}
