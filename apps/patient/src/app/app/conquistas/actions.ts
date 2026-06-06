"use server";

// Conquistas/badges do paciente — DERIVADAS dos dados existentes
// (UserHealthStreak + metas concluídas). Sem tabela nova: calculado on-read.

import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface Achievement {
  key: string;
  label: string;
  description: string;
  icon: string; // chave mapeada para um ícone no client
  unlocked: boolean;
  current: number;
  target: number;
}

export async function getAchievementsAction(): Promise<Achievement[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const streak = await prisma.userHealthStreak.findUnique({
      where: { userId: user.id },
      select: { longestStreak: true, totalCheckins: true },
    });
    const total = streak?.totalCheckins ?? 0;
    const longest = streak?.longestStreak ?? 0;

    const patients = await prisma.patient.findMany({
      where: { userId: user.id, status: "ACTIVE" },
      select: { id: true },
    });
    const patientIds = patients.map((p: { id: string }) => p.id);
    const goalsAchieved =
      patientIds.length > 0
        ? await prisma.patientGoal.count({
            where: { patientId: { in: patientIds }, status: "ACHIEVED" },
          })
        : 0;

    const defs: Array<Omit<Achievement, "unlocked"> & { value: number }> = [
      {
        key: "first_checkin",
        label: "Primeiro passo",
        description: "Fez seu primeiro check-in",
        icon: "sparkles",
        current: Math.min(total, 1),
        target: 1,
        value: total,
      },
      {
        key: "checkins_10",
        label: "Consistente",
        description: "10 check-ins registrados",
        icon: "checkcheck",
        current: Math.min(total, 10),
        target: 10,
        value: total,
      },
      {
        key: "checkins_50",
        label: "Dedicado",
        description: "50 check-ins registrados",
        icon: "medal",
        current: Math.min(total, 50),
        target: 50,
        value: total,
      },
      {
        key: "streak_7",
        label: "Uma semana",
        description: "7 dias seguidos de check-in",
        icon: "flame",
        current: Math.min(longest, 7),
        target: 7,
        value: longest,
      },
      {
        key: "streak_30",
        label: "Um mês",
        description: "30 dias seguidos de check-in",
        icon: "flame",
        current: Math.min(longest, 30),
        target: 30,
        value: longest,
      },
      {
        key: "streak_100",
        label: "Imparável",
        description: "100 dias seguidos de check-in",
        icon: "trophy",
        current: Math.min(longest, 100),
        target: 100,
        value: longest,
      },
      {
        key: "goal_achieved",
        label: "Meta batida",
        description: "Concluiu uma meta com seu nutricionista",
        icon: "target",
        current: Math.min(goalsAchieved, 1),
        target: 1,
        value: goalsAchieved,
      },
    ];

    return defs.map((d) => ({
      key: d.key,
      label: d.label,
      description: d.description,
      icon: d.icon,
      current: d.current,
      target: d.target,
      unlocked: d.value >= d.target,
    }));
  } catch {
    return [];
  }
}
