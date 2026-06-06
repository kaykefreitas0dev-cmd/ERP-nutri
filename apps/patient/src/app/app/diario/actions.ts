"use server";

// Diário alimentar do paciente. User-scoped (escopado pelo user.id autenticado).
// Paciente registra o que comeu por refeição (texto livre).

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface DiaryEntryView {
  id: string;
  entryDate: string; // YYYY-MM-DD
  mealLabel: string;
  description: string;
  followedPlan: boolean | null;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const AddSchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealLabel: z.string().min(1).max(80).trim(),
  description: z.string().min(1).max(1000).trim(),
  followedPlan: z.boolean().nullable().optional(),
});

export async function addDiaryEntryAction(input: {
  entryDate: string;
  mealLabel: string;
  description: string;
  followedPlan?: boolean | null;
}): Promise<{ ok: boolean; message?: string }> {
  const parsed = AddSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados inválidos" };
  const d = parsed.data;

  // Anti-backdating: no máximo 7 dias atrás, nunca no futuro.
  // (BR é UTC-2..UTC-5, então a data local nunca é > data UTC → diffDays >= 0
  // para hoje/passado; rejeitar diffDays < 0 bloqueia datas futuras.)
  const entry = new Date(d.entryDate + "T12:00:00Z");
  const today = new Date();
  today.setUTCHours(12, 0, 0, 0);
  const diffDays = (today.getTime() - entry.getTime()) / 86_400_000;
  if (diffDays > 7)
    return { ok: false, message: "Data muito antiga (máx. 7 dias)" };
  if (diffDays < 0) return { ok: false, message: "Data não pode ser futura" };

  try {
    const userId = await getUserId();
    if (!userId) return { ok: false, message: "Não autenticado" };
    await prisma.foodDiaryEntry.create({
      data: {
        userId,
        entryDate: entry,
        mealLabel: d.mealLabel,
        description: d.description,
        followedPlan: d.followedPlan ?? null,
      },
    });
    revalidatePath("/app/diario");
    return { ok: true };
  } catch {
    return { ok: false, message: "Erro ao salvar" };
  }
}

export async function listDiaryEntriesAction(
  days = 7,
): Promise<DiaryEntryView[]> {
  const take = Math.min(Math.max(days, 1), 30) * 8; // ~8 refeições/dia máx
  try {
    const userId = await getUserId();
    if (!userId) return [];
    const rows = await prisma.foodDiaryEntry.findMany({
      where: { userId },
      orderBy: [{ entryDate: "desc" }, { createdAt: "asc" }],
      take,
      select: {
        id: true,
        entryDate: true,
        mealLabel: true,
        description: true,
        followedPlan: true,
      },
    });
    return rows.map(
      (r: {
        id: string;
        entryDate: Date;
        mealLabel: string;
        description: string;
        followedPlan: boolean | null;
      }) => ({
        id: r.id,
        entryDate: r.entryDate.toISOString().slice(0, 10),
        mealLabel: r.mealLabel,
        description: r.description,
        followedPlan: r.followedPlan,
      }),
    );
  } catch {
    return [];
  }
}

export async function deleteDiaryEntryAction(
  id: string,
): Promise<{ ok: boolean }> {
  if (!id || !UUID_REGEX.test(id)) return { ok: false };
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };
    // updateMany-style ownership: só apaga se for do próprio user.
    await prisma.foodDiaryEntry.deleteMany({ where: { id, userId } });
    revalidatePath("/app/diario");
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
