import Link from "next/link";
import {
  ArrowLeft,
  Flame,
  CircleCheck,
  TriangleAlert,
  Droplets,
  Scale,
  CalendarDays,
  Frown,
  Annoyed,
  Meh,
  Smile,
  SmilePlus,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Histórico de check-ins — NutriCore" };

const MOOD_ICONS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, SmilePlus];
const MOOD_LABELS = ["Muito mal", "Mal", "Ok", "Bem", "Muito bem"];

/** Maps mood 1-5 to a CSS background color token string (inline style). */
function moodColor(mood: number | null): string {
  if (!mood) return "var(--color-bg-subtle)";
  const map: Record<number, string> = {
    1: "var(--color-danger)",
    2: "var(--color-warning)",
    3: "var(--color-text-muted)",
    4: "var(--color-success)",
    5: "var(--color-brand-primary)",
  };
  return map[mood] ?? "var(--color-bg-subtle)";
}

function moodOpacity(mood: number | null): number {
  if (!mood) return 0.15;
  // Scale: 1→30%, 2→50%, 3→60%, 4→75%, 5→100%
  return [0.3, 0.5, 0.6, 0.75, 1.0][mood - 1] ?? 0.5;
}

function todayLocalISO(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

/** Returns ISO date string YYYY-MM-DD for `n` days before `base`. */
function daysAgo(base: string, n: number): string {
  const d = new Date(base + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function AvgMoodCard({ avgMood }: { avgMood: number }) {
  const rounded = Math.round(avgMood) as 1 | 2 | 3 | 4 | 5;
  const AvgIcon = MOOD_ICONS[rounded - 1]!;
  return (
    <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-center justify-between">
        <p className="text-tiny text-text-muted">Humor médio</p>
        <AvgIcon className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
      </div>
      <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
        {avgMood.toFixed(1)}
        <span className="ml-1 text-body font-normal text-text-muted">/5</span>
      </p>
      <p className="mt-1 text-tiny text-text-muted">
        {MOOD_LABELS[rounded - 1]}
      </p>
    </div>
  );
}

export default async function CheckinHistoricoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = todayLocalISO();

  const [streak, checkins] = await Promise.all([
    prisma.userHealthStreak.findUnique({ where: { userId: user!.id } }),
    prisma.userHealthCheckin.findMany({
      where: { userId: user!.id },
      orderBy: { checkinDate: "desc" },
      take: 90,
      select: {
        id: true,
        checkinDate: true,
        mood: true,
        energyLevel: true,
        hungerLevel: true,
        waterMl: true,
        weightKg: true,
        followedPlan: true,
        notes: true,
      },
    }),
  ]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const total = checkins.length;
  const followed = checkins.filter((c) => c.followedPlan === true).length;
  const adherencePct = total > 0 ? Math.round((followed / total) * 100) : null;
  const avgMood =
    checkins.filter((c) => c.mood).length > 0
      ? checkins.reduce((s, c) => s + (c.mood ?? 0), 0) /
        checkins.filter((c) => c.mood).length
      : null;

  // ── Last 35 days grid (5 weeks × 7 days) ──────────────────────────────────
  // Build a map: ISO date → checkin
  const checkinByDate = new Map(
    checkins.map((c) => [c.checkinDate.toISOString().slice(0, 10), c]),
  );

  // Build 35 cells: index 0 = most recent (today)
  const gridDays = Array.from({ length: 35 }, (_, i) => {
    const iso = daysAgo(today, i);
    const checkin = checkinByDate.get(iso) ?? null;
    return { iso, checkin };
  }).reverse(); // now index 0 = 34 days ago, index 34 = today

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      {/* Back */}
      <Link
        href="/app/checkin"
        className="inline-flex items-center gap-1.5 text-tiny text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Check-in de hoje
      </Link>

      <h1 className="mt-3 text-h1 font-bold tracking-tight text-text-primary">
        Histórico
      </h1>
      <p className="mt-1 text-caption text-text-secondary">
        Seus últimos {total} check-in{total === 1 ? "" : "s"} registrados.
      </p>

      {total === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default py-12 text-center">
          <CalendarDays
            className="h-10 w-10 text-text-muted"
            strokeWidth={1.25}
          />
          <p className="text-body font-medium text-text-secondary">
            Nenhum check-in ainda
          </p>
          <p className="max-w-xs text-tiny text-text-muted">
            Faça seu primeiro check-in diário para começar a acompanhar seu
            progresso.
          </p>
          <Link
            href="/app/checkin"
            className="mt-2 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white hover:bg-brand-primary-hover"
          >
            Fazer check-in
          </Link>
        </div>
      ) : (
        <>
          {/* ── Stats cards ─────────────────────────────────────────────── */}
          <section className="mt-5 grid grid-cols-2 gap-3">
            {/* Streak */}
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
              <div className="flex items-center justify-between">
                <p className="text-tiny text-text-muted">Sequência atual</p>
                <Flame
                  className="h-4 w-4"
                  style={{ color: "var(--color-warning)" }}
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                {streak?.currentStreak ?? 0}
                <span className="ml-1 text-body font-normal text-text-muted">
                  dias
                </span>
              </p>
              {streak && streak.longestStreak > 0 && (
                <p className="mt-1 text-tiny text-text-muted">
                  Recorde: {streak.longestStreak} dia
                  {streak.longestStreak === 1 ? "" : "s"}
                </p>
              )}
            </div>

            {/* Total check-ins */}
            <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
              <div className="flex items-center justify-between">
                <p className="text-tiny text-text-muted">Total check-ins</p>
                <CircleCheck
                  className="h-4 w-4 text-brand-primary"
                  strokeWidth={1.75}
                />
              </div>
              <p className="mt-2 text-h1 font-bold tabular-nums text-text-primary">
                {total}
              </p>
              {adherencePct !== null && (
                <p className="mt-1 text-tiny text-text-muted">
                  {adherencePct}% seguiu o plano
                </p>
              )}
            </div>

            {/* Adesão ao plano */}
            {adherencePct !== null && (
              <div className="flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
                <div className="flex items-center justify-between">
                  <p className="text-tiny text-text-muted">Adesão ao plano</p>
                  <CircleCheck
                    className="h-4 w-4 text-success"
                    strokeWidth={1.75}
                  />
                </div>
                <p
                  className={
                    "mt-2 text-h1 font-bold tabular-nums " +
                    (adherencePct >= 80
                      ? "text-success"
                      : adherencePct >= 60
                        ? "text-warning"
                        : "text-danger")
                  }
                >
                  {adherencePct}%
                </p>
                <p className="mt-1 text-tiny text-text-muted">
                  {followed} de {total} dias
                </p>
              </div>
            )}

            {/* Humor médio */}
            {avgMood !== null && <AvgMoodCard avgMood={avgMood} />}
          </section>

          {/* ── Mood calendar grid (last 35 days) ────────────────────────── */}
          <section className="mt-6">
            <h2 className="text-body font-semibold text-text-primary">
              Últimas 5 semanas
            </h2>
            <p className="mt-0.5 text-tiny text-text-muted">
              Cada quadrado representa um dia. Cores indicam humor.
            </p>

            {/* Day-of-week headers */}
            <div className="mt-3 grid grid-cols-7 gap-1 text-center">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <p
                  key={i}
                  className="text-[10px] font-semibold uppercase tracking-wider text-text-muted"
                >
                  {d}
                </p>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {gridDays.map(({ iso, checkin }) => {
                const isToday = iso === today;
                const bg = moodColor(checkin?.mood ?? null);
                const opacity = moodOpacity(checkin?.mood ?? null);
                return (
                  <div
                    key={iso}
                    title={
                      checkin
                        ? `${new Date(iso + "T12:00:00Z").toLocaleDateString("pt-BR")} — humor ${checkin.mood ?? "—"}/5`
                        : new Date(iso + "T12:00:00Z").toLocaleDateString(
                            "pt-BR",
                          )
                    }
                    className={
                      "aspect-square rounded-sm " +
                      (isToday ? "ring-2 ring-brand-primary ring-offset-1" : "")
                    }
                    style={{ backgroundColor: bg, opacity }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-3 flex items-center gap-3 text-[10px] text-text-muted">
              <span>Humor:</span>
              {[1, 2, 3, 4, 5].map((m) => (
                <span key={m} className="flex items-center gap-1">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{
                      backgroundColor: moodColor(m),
                      opacity: moodOpacity(m),
                    }}
                  />
                  {m}
                </span>
              ))}
              <span className="ml-auto flex items-center gap-1">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{
                    backgroundColor: "var(--color-bg-subtle)",
                    opacity: 0.15,
                  }}
                />
                sem dados
              </span>
            </div>
          </section>

          {/* ── Full history list ─────────────────────────────────────────── */}
          <section className="mt-6">
            <h2 className="text-body font-semibold text-text-primary">
              Histórico detalhado
            </h2>
            <ul className="mt-3 space-y-2">
              {checkins.map((c) => {
                const MoodIcon = c.mood ? MOOD_ICONS[c.mood - 1] : null;
                const dateStr = new Date(c.checkinDate).toLocaleDateString(
                  "pt-BR",
                  {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  },
                );

                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-border-subtle bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]"
                  >
                    {/* Header row */}
                    <div className="flex items-center justify-between">
                      <p className="text-tiny font-semibold capitalize text-text-secondary tabular-nums">
                        {dateStr}
                      </p>
                      <span className="flex items-center gap-2">
                        {MoodIcon && (
                          <MoodIcon
                            className="h-4 w-4 text-text-muted"
                            strokeWidth={1.75}
                            aria-label={`Humor: ${MOOD_LABELS[(c.mood ?? 1) - 1]}`}
                          />
                        )}
                        {c.followedPlan === true && (
                          <CircleCheck
                            className="h-4 w-4 text-success"
                            strokeWidth={1.75}
                            aria-label="Seguiu o plano"
                          />
                        )}
                        {c.followedPlan === false && (
                          <TriangleAlert
                            className="h-4 w-4 text-warning"
                            strokeWidth={1.75}
                            aria-label="Não seguiu o plano"
                          />
                        )}
                      </span>
                    </div>

                    {/* Data chips */}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.mood && (
                        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary">
                          😊 {c.mood}/5
                        </span>
                      )}
                      {c.energyLevel && (
                        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary">
                          ⚡ energia {c.energyLevel}/5
                        </span>
                      )}
                      {c.hungerLevel && (
                        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary">
                          🍽️ fome {c.hungerLevel}/5
                        </span>
                      )}
                      {c.waterMl != null && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary">
                          <Droplets
                            className="h-3 w-3"
                            strokeWidth={1.75}
                            style={{ color: "var(--color-macro-water)" }}
                          />
                          {c.waterMl}ml
                        </span>
                      )}
                      {c.weightKg && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-bg-subtle px-2 py-0.5 text-tiny text-text-secondary">
                          <Scale className="h-3 w-3" strokeWidth={1.75} />
                          {Number(c.weightKg).toFixed(1)}kg
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    {c.notes && (
                      <p className="mt-2 border-t border-border-subtle pt-2 text-tiny italic text-text-muted">
                        &ldquo;{c.notes}&rdquo;
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>

            {total >= 90 && (
              <p className="mt-4 text-center text-tiny text-text-muted">
                Exibindo os últimos 90 check-ins.
              </p>
            )}
          </section>

          {/* Nota motivacional */}
          <p className="mt-6 rounded-lg border border-border-subtle bg-bg-subtle px-4 py-3 text-tiny text-text-muted">
            Consistência é mais importante do que perfeição. Cada check-in
            registrado ajuda seu nutricionista a personalizar seu atendimento.
          </p>
        </>
      )}
    </div>
  );
}
