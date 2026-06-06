"use server";

// Metas do paciente (visão + atualização pelo próprio paciente).
// PatientGoal é tenant-scoped (org), mas o paciente é User cross-org (Lock 6):
// resolvemos as Patient rows do user e escopamos as metas a elas. Toda
// atualização verifica que a meta pertence a um Patient do user autenticado.

import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PatientGoalView {
  id: string;
  title: string;
  description: string | null;
  direction: string;
  unit: string | null;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  dueDate: string | null; // YYYY-MM-DD
  orgName: string;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const num = (v: { toString(): string } | null): number | null =>
  v != null ? Number(v.toString()) : null;

export async function listPatientGoalsAction(): Promise<PatientGoalView[]> {
  try {
    const userId = await getUserId();
    if (!userId) return [];

    const patients = await prisma.patient.findMany({
      where: { userId, status: "ACTIVE" },
      select: { id: true, organization: { select: { name: true } } },
    });
    if (patients.length === 0) return [];

    const orgNameByPatient = new Map<string, string>(
      patients.map(
        (p: { id: string; organization: { name: string } }) =>
          [p.id, p.organization.name] as [string, string],
      ),
    );
    const patientIds = patients.map((p: { id: string }) => p.id);

    const goals = await prisma.patientGoal.findMany({
      where: { patientId: { in: patientIds }, status: "ACTIVE" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        patientId: true,
        title: true,
        description: true,
        direction: true,
        unit: true,
        startValue: true,
        targetValue: true,
        currentValue: true,
        dueDate: true,
      },
    });

    interface GRow {
      id: string;
      patientId: string;
      title: string;
      description: string | null;
      direction: string;
      unit: string | null;
      startValue: { toString(): string } | null;
      targetValue: { toString(): string } | null;
      currentValue: { toString(): string } | null;
      dueDate: Date | null;
    }

    return goals.map((g: GRow) => ({
      id: g.id,
      title: g.title,
      description: g.description,
      direction: g.direction,
      unit: g.unit,
      startValue: num(g.startValue),
      targetValue: num(g.targetValue),
      currentValue: num(g.currentValue),
      dueDate: g.dueDate ? g.dueDate.toISOString().slice(0, 10) : null,
      orgName: orgNameByPatient.get(g.patientId) ?? "",
    }));
  } catch {
    return [];
  }
}

export async function updatePatientGoalProgressAction(input: {
  goalId: string;
  currentValue: number;
}): Promise<{ ok: boolean; message?: string }> {
  if (!input.goalId || !UUID_REGEX.test(input.goalId)) {
    return { ok: false, message: "Meta inválida" };
  }
  if (
    typeof input.currentValue !== "number" ||
    !Number.isFinite(input.currentValue) ||
    input.currentValue < -100000 ||
    input.currentValue > 1000000
  ) {
    return { ok: false, message: "Valor inválido" };
  }
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false, message: "Não autenticado" };

    // A meta deve pertencer a um Patient deste usuário (ownership).
    const goal = await prisma.patientGoal.findUnique({
      where: { id: input.goalId },
      select: { patientId: true },
    });
    if (!goal) return { ok: false, message: "Meta não encontrada" };
    const owns = await prisma.patient.findFirst({
      where: { id: goal.patientId, userId },
      select: { id: true },
    });
    if (!owns) return { ok: false, message: "Sem permissão" };

    await prisma.patientGoal.update({
      where: { id: input.goalId },
      data: { currentValue: input.currentValue },
    });
    return { ok: true };
  } catch {
    return { ok: false, message: "Erro ao salvar" };
  }
}
