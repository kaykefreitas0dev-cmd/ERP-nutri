import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckinForm } from "./CheckinForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-in diário" };

function todayLocalISO(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default async function CheckinPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayLocalISO();
  const todayDate = new Date(today + "T12:00:00Z");

  const [existing, streak, last7] = await Promise.all([
    prisma.userHealthCheckin.findUnique({
      where: {
        userId_checkinDate: { userId: user!.id, checkinDate: todayDate },
      },
    }),
    prisma.userHealthStreak.findUnique({ where: { userId: user!.id } }),
    prisma.userHealthCheckin.findMany({
      where: { userId: user!.id },
      orderBy: { checkinDate: "desc" },
      take: 7,
      select: {
        id: true,
        checkinDate: true,
        mood: true,
        weightKg: true,
        waterMl: true,
        followedPlan: true,
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Check-in de hoje</h1>
        <p className="mt-1 text-sm text-slate-600">
          Como foi seu dia? Responda em ~30 segundos.
        </p>
      </header>

      {/* Streak badge */}
      {streak && streak.currentStreak > 0 && (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 p-3">
          <p className="text-sm text-orange-900">
            🔥 <strong>{streak.currentStreak} dia(s)</strong> seguidos!
            {streak.longestStreak > streak.currentStreak && (
              <span className="ml-1 text-xs text-orange-700">
                (recorde: {streak.longestStreak})
              </span>
            )}
          </p>
        </div>
      )}

      <div className="mt-6">
        <CheckinForm
          todayISO={today}
          initial={
            existing
              ? {
                  mood: existing.mood,
                  energyLevel: existing.energyLevel,
                  hungerLevel: existing.hungerLevel,
                  waterMl: existing.waterMl,
                  weightKg: existing.weightKg
                    ? Number(existing.weightKg)
                    : null,
                  followedPlan: existing.followedPlan,
                  notes: existing.notes,
                }
              : null
          }
        />
      </div>

      {/* Histórico últimos 7 dias */}
      {last7.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-slate-700">
            Últimos check-ins
          </h2>
          <ul className="mt-2 space-y-1">
            {last7.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="text-xs text-slate-600">
                  {new Date(c.checkinDate).toLocaleDateString("pt-BR")}
                </span>
                <span className="flex items-center gap-3 text-xs text-slate-700">
                  {c.mood && (
                    <span>{["😞", "😕", "😐", "🙂", "😄"][c.mood - 1]}</span>
                  )}
                  {c.waterMl != null && <span>💧 {c.waterMl}ml</span>}
                  {c.weightKg && (
                    <span>⚖️ {Number(c.weightKg).toFixed(1)}kg</span>
                  )}
                  {c.followedPlan === true && (
                    <span className="text-green-700">✅ plano</span>
                  )}
                  {c.followedPlan === false && (
                    <span className="text-amber-700">⚠️ off-plan</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
