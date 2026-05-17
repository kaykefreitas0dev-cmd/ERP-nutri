import {
  Flame,
  Droplets,
  Scale,
  CircleCheck,
  TriangleAlert,
  Frown,
  Annoyed,
  Meh,
  Smile,
  SmilePlus,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CheckinForm } from "./CheckinForm";

const MOOD_ICONS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, SmilePlus];

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
        <h1 className="text-2xl font-bold text-text-primary">
          Check-in de hoje
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Como foi seu dia? Responda em ~30 segundos.
        </p>
      </header>

      {/* Streak badge */}
      {streak && streak.currentStreak > 0 && (
        <div className="mt-4 rounded-lg border border-warning-border bg-warning-bg p-3">
          <p className="flex items-center gap-2 text-sm text-warning">
            <Flame className="h-4 w-4" strokeWidth={1.75} />
            <strong className="tabular-nums">
              {streak.currentStreak}
            </strong>{" "}
            dia(s) seguidos!
            {streak.longestStreak > streak.currentStreak && (
              <span className="ml-1 text-xs opacity-80">
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
          <h2 className="text-sm font-semibold text-text-secondary">
            Últimos check-ins
          </h2>
          <ul className="mt-2 space-y-1">
            {last7.map((c) => {
              const MoodIcon = c.mood ? MOOD_ICONS[c.mood - 1] : null;
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-sm"
                >
                  <span className="text-xs text-text-secondary tabular-nums">
                    {new Date(c.checkinDate).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-text-secondary">
                    {MoodIcon && (
                      <MoodIcon
                        className="h-4 w-4 text-text-muted"
                        strokeWidth={1.75}
                      />
                    )}
                    {c.waterMl != null && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Droplets
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                          style={{ color: "var(--color-macro-water)" }}
                        />
                        {c.waterMl}ml
                      </span>
                    )}
                    {c.weightKg && (
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Scale className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {Number(c.weightKg).toFixed(1)}kg
                      </span>
                    )}
                    {c.followedPlan === true && (
                      <span className="inline-flex items-center gap-1 text-success">
                        <CircleCheck
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                        plano
                      </span>
                    )}
                    {c.followedPlan === false && (
                      <span className="inline-flex items-center gap-1 text-warning">
                        <TriangleAlert
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                        />
                        off-plan
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
