"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface CheckinResult {
  ok: boolean;
  message?: string;
  checkin?: {
    id: string;
    checkinDate: Date;
    streak: number;
  };
}

const CheckinSchema = z.object({
  // Data calendário no formato YYYY-MM-DD (no tz do cliente)
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mood: z.coerce.number().int().min(1).max(5).optional(),
  energyLevel: z.coerce.number().int().min(1).max(5).optional(),
  hungerLevel: z.coerce.number().int().min(1).max(5).optional(),
  waterMl: z.coerce.number().int().min(0).max(20000).optional(),
  weightKg: z.coerce.number().min(20).max(400).optional(),
  followedPlan: z.coerce.boolean().optional(),
  notes: z.string().max(500).optional().or(z.literal("")),
});

/**
 * Cria ou atualiza o check-in do dia.
 * - 1 check-in por usuário por dia (UNIQUE) — upsert idempotente
 * - Backdating limitado a 24h (não pode lançar de dias passados arbitrários)
 * - Atualiza streak: contínuo se ontem teve check-in, reset se não
 */
export async function upsertCheckinAction(
  formData: FormData,
): Promise<CheckinResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado" };

  const raw = {
    checkinDate: formData.get("checkinDate"),
    mood: formData.get("mood") || undefined,
    energyLevel: formData.get("energyLevel") || undefined,
    hungerLevel: formData.get("hungerLevel") || undefined,
    waterMl: formData.get("waterMl") || undefined,
    weightKg: formData.get("weightKg") || undefined,
    followedPlan: formData.get("followedPlan") === "true" ? "true" : undefined,
    notes: formData.get("notes") || "",
  };

  const parsed = CheckinSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;

  // Anti-cheat: backdating máx 24h
  const checkinDate = new Date(d.checkinDate + "T12:00:00Z");
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const diffMs = today.getTime() - checkinDate.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  if (diffMs > ONE_DAY_MS) {
    return {
      ok: false,
      message: "Não é possível registrar check-in de mais de 24h atrás",
    };
  }
  if (diffMs < -ONE_DAY_MS) {
    return { ok: false, message: "Data inválida" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Upsert check-in
      const checkin = await tx.userHealthCheckin.upsert({
        where: {
          userId_checkinDate: { userId: user.id, checkinDate },
        },
        update: {
          mood: d.mood ?? null,
          energyLevel: d.energyLevel ?? null,
          hungerLevel: d.hungerLevel ?? null,
          waterMl: d.waterMl ?? null,
          weightKg: d.weightKg ?? null,
          followedPlan: d.followedPlan ?? null,
          notes: d.notes || null,
        },
        create: {
          userId: user.id,
          checkinDate,
          mood: d.mood ?? null,
          energyLevel: d.energyLevel ?? null,
          hungerLevel: d.hungerLevel ?? null,
          waterMl: d.waterMl ?? null,
          weightKg: d.weightKg ?? null,
          followedPlan: d.followedPlan ?? null,
          notes: d.notes || null,
          source: "patient_app",
        },
      });

      // Recalcular streak
      // Strategy: pegar last_checkin_date atual; se for ontem ou hoje + check-in atual é hoje, incrementa; else reset to 1
      const existing = await tx.userHealthStreak.findUnique({
        where: { userId: user.id },
      });

      let newCurrent = 1;
      const yesterday = new Date(checkinDate);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      if (existing?.lastCheckinDate) {
        const last = new Date(existing.lastCheckinDate);
        last.setUTCHours(12, 0, 0, 0);
        if (last.getTime() === checkinDate.getTime()) {
          // Mesmo dia — não muda streak
          newCurrent = existing.currentStreak;
        } else if (last.getTime() === yesterday.getTime()) {
          // Dia anterior — incrementa
          newCurrent = existing.currentStreak + 1;
        } else {
          // Gap — reseta
          newCurrent = 1;
        }
      }

      const newLongest = Math.max(newCurrent, existing?.longestStreak ?? 0);
      const total = existing?.totalCheckins ?? 0;
      const isNewDay =
        !existing?.lastCheckinDate ||
        new Date(existing.lastCheckinDate).getTime() !== checkinDate.getTime();
      const newTotal = isNewDay ? total + 1 : total;

      await tx.userHealthStreak.upsert({
        where: { userId: user.id },
        update: {
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastCheckinDate: checkinDate,
          totalCheckins: newTotal,
        },
        create: {
          userId: user.id,
          currentStreak: newCurrent,
          longestStreak: newLongest,
          lastCheckinDate: checkinDate,
          totalCheckins: newTotal,
        },
      });

      return { checkin, streak: newCurrent };
    });

    revalidatePath("/app");
    revalidatePath("/app/checkin");
    return {
      ok: true,
      checkin: {
        id: result.checkin.id,
        checkinDate: result.checkin.checkinDate,
        streak: result.streak,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
