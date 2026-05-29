/**
 * GET /api/v1/patients/[id]/evolution-report/pdf
 *
 * Gera e serve o Relatório de Evolução do paciente on-the-fly.
 * Consolida antropometria + engajamento (check-ins) + planos alimentares.
 * Tenant-aware via withTenantAction (RLS garante isolamento).
 * runtime = "nodejs" — pdfkit precisa de fs.
 *
 * Leitura de PHI → audit log detalhado (LGPD).
 */

import { NextRequest, NextResponse } from "next/server";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import {
  renderEvolutionReportPdf,
  type EvolutionAnthropometry,
  type EvolutionCheckins,
  type EvolutionMealPlan,
} from "@/lib/pdf/evolution-report-pdf";
import { appendAuditLog } from "@nutricore/db/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface Params {
  params: Promise<{ id: string }>;
}

function calcAge(birthDate: Date | null): string | null {
  if (!birthDate) return null;
  const today = new Date();
  const bd = new Date(birthDate);
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  if (age < 0 || age > 130) return null;
  return `${age} anos`;
}

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // 1. Paciente (RLS garante tenant). PHI: nome, cpf, nascimento.
        const patient = await tx.patient.findFirst({
          where: { id },
          select: {
            id: true,
            fullName: true,
            cpf: true,
            birthDate: true,
            userId: true,
          },
        });
        if (!patient) return null;

        // 2. Antropometria (cronológica ASC para o relatório).
        // CORREÇÃO: serializado — pg adapter compartilha 1 connection na tx.
        const anthroRows = await tx.anthropometry.findMany({
          where: { patientId: patient.id },
          orderBy: { measuredAt: "asc" },
          take: 100,
          select: {
            measuredAt: true,
            weightKg: true,
            heightCm: true,
            bodyMassIndex: true,
            bodyFatPctCalc: true,
            basalMetabolismMifflin: true,
          },
        });

        // 3. Engajamento (somente se o paciente tem conta no app).
        let checkins: EvolutionCheckins | null = null;
        if (patient.userId) {
          const streak = await tx.userHealthStreak.findUnique({
            where: { userId: patient.userId },
            select: {
              currentStreak: true,
              longestStreak: true,
              totalCheckins: true,
              lastCheckinDate: true,
            },
          });
          const recent = await tx.userHealthCheckin.findMany({
            where: { userId: patient.userId },
            orderBy: { checkinDate: "desc" },
            take: 60,
            select: {
              mood: true,
              energyLevel: true,
              waterMl: true,
              followedPlan: true,
            },
          });
          const last30 = recent.slice(0, 30);
          const followed = last30.filter(
            (c: { followedPlan: boolean | null }) => c.followedPlan === true,
          ).length;
          const withPlan = last30.filter(
            (c: { followedPlan: boolean | null }) => c.followedPlan !== null,
          ).length;
          checkins = {
            totalCheckins: streak?.totalCheckins ?? recent.length,
            currentStreak: streak?.currentStreak ?? 0,
            longestStreak: streak?.longestStreak ?? 0,
            avgMood: avg(last30.map((c: { mood: number | null }) => c.mood)),
            avgEnergy: avg(
              last30.map((c: { energyLevel: number | null }) => c.energyLevel),
            ),
            avgWaterMl: avg(
              last30.map((c: { waterMl: number | null }) => c.waterMl),
            ),
            adherencePct:
              withPlan > 0 ? Math.round((followed / withPlan) * 100) : null,
            daysTracked: recent.length,
            lastCheckinDate: streak?.lastCheckinDate ?? null,
          };
        }

        // 4. Planos alimentares (histórico).
        const planRows = await tx.mealPlan.findMany({
          where: { patientId: patient.id },
          orderBy: { createdAt: "desc" },
          take: 30,
          select: {
            name: true,
            status: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        });

        // 5. Emissor (nome + CRN).
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { fullName: true },
        });
        const bookingPage = await tx.bookingPage.findFirst({
          where: { professionalUserId: userId, organizationId },
          select: { displayName: true, crn: true, crnUf: true },
        });

        // 6. Audit (leitura de PHI longitudinal).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "patient.evolution_report_download",
          entityType: "Patient",
          entityId: patient.id,
          patientId: patient.id,
          fieldsAccessed: ["anthropometry", "checkins", "mealPlans"],
          payload: {},
        });

        return {
          patient,
          anthroRows,
          checkins,
          planRows,
          issuerName:
            bookingPage?.displayName ?? user?.fullName ?? "Nutricionista",
          issuerCrn: bookingPage?.crn ?? null,
          issuerCrnUf: bookingPage?.crnUf ?? null,
        };
      },
    );

    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // Conversão Decimal → number. `tx` é frouxamente tipado, anotamos as linhas.
    type RawAnthro = {
      measuredAt: Date;
      weightKg: unknown;
      heightCm: unknown;
      bodyMassIndex: unknown;
      bodyFatPctCalc: unknown;
      basalMetabolismMifflin: unknown;
    };
    type RawPlan = {
      name: string;
      status: string;
      startDate: Date | null;
      endDate: Date | null;
      createdAt: Date;
    };

    const num = (v: unknown): number | null => (v != null ? Number(v) : null);

    const anthropometry: EvolutionAnthropometry[] = (
      result.anthroRows as RawAnthro[]
    ).map((r) => ({
      measuredAt: r.measuredAt,
      weightKg: num(r.weightKg),
      heightCm: num(r.heightCm),
      bodyMassIndex: num(r.bodyMassIndex),
      bodyFatPctCalc: num(r.bodyFatPctCalc),
      basalMetabolismMifflin: num(r.basalMetabolismMifflin),
    }));

    const mealPlans: EvolutionMealPlan[] = (result.planRows as RawPlan[]).map(
      (p) => ({
        name: p.name,
        status: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        createdAt: p.createdAt,
      }),
    );

    const buffer = await renderEvolutionReportPdf({
      issuerName: result.issuerName,
      issuerCrn: result.issuerCrn,
      issuerCrnUf: result.issuerCrnUf,
      patientName: result.patient.fullName,
      patientCpf: result.patient.cpf ?? null,
      patientAge: calcAge(result.patient.birthDate),
      generatedAt: new Date(),
      anthropometry,
      checkins: result.checkins,
      mealPlans,
    });

    const filename =
      slugify(`relatorio-evolucao-${result.patient.fullName}`) + ".pdf";

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
