import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Frown,
  Annoyed,
  Meh,
  Smile,
  SmilePlus,
  Droplets,
  Scale,
  CircleCheck,
  TriangleAlert,
  ChevronLeft,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Histórico de check-ins" };

const MOOD_ICONS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, SmilePlus];
const MOOD_LABELS = ["Péssimo", "Ruim", "Ok", "Bom", "Ótimo"];

function todayLocalISO(): string {
  return new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Sao_Paulo",
  });
}

// Returns the ISO date string for N days before the given base date (UTC-stable)
function daysAgo(base: string, n: number): string {
  const d = new Date(base + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toLocaleDateString("sv-SE", { timeZone: "UTC" });
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Sao_Paulo",
  });
}

// Mood color for the calendar grid cell
function moodBgColor(mood: number | null): string {
  if (mood == null) return "var(--color-bg-subtle)";
  const colors = [
    "var(--color-danger)",
    "var(--color-warning)",
    "var(--color-text-muted)",
    "var(--color-success)",
    "var(--color-brand-primary)",
  ];
  return colors[mood - 1] ?? "var(--color-bg-subtle)";
}

function moodOpacity(mood: number | null): number {
  if (mood == null) return 0.12;
  return [0.3, 0.5, 0.6, 0.75, 1.0][mood - 1] ?? 0.5;
}

export default async function CheckinHistoricoPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // CORREÇÃO QA #55: defense-in-depth contra cookie expirar in-flight.
  if (!user) {
    redirect("/login?redirectTo=/app/checkin/historico");
  }

  const checkins = await prisma.userHealthCheckin.findMany({
    where: { userId: user.id },
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
  });

  // Build a map from ISO date string → checkin
  const byDate = new Map(
    checkins.map((c) => [
      c.checkinDate.toLocaleDateString("sv-SE", { timeZone: "UTC" }),
      c,
    ]),
  );

  const today = todayLocalISO();

  // 35-day grid (5 weeks), index 0 = 34 days ago, index 34 = today
  const gridDays = Array.from({ length: 35 }, (_, i) => {
    const iso = daysAgo(today, 34 - i);
    const c = byDate.get(iso);
    return { iso, checkin: c ?? null };
  });

  // Stats from all loaded checkins
  const total = checkins.length;
  const followed = checkins.filter((c) => c.followedPlan === true).length;
  const adherencePct = total > 0 ? Math.round((followed / total) * 100) : null;
  const avgMood =
    total > 0
      ? checkins
          .filter((c) => c.mood != null)
          .reduce((s, c) => s + (c.mood ?? 0), 0) /
        checkins.filter((c) => c.mood != null).length
      : null;

  return (
    <div className="mx-auto max-w-3xl px-5 py-6 pb-24">
      {/* Back link */}
      <Link
        href="/app/checkin"
        className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Check-in de hoje
      </Link>

      <header className="mt-4">
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          Seu histórico
        </p>
        <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
          Check-ins
        </h1>
      </header>

      {total === 0 ? (
        <div className="mt-10 rounded-xl border border-border-subtle bg-bg-subtle px-6 py-10 text-center">
          <Meh
            className="mx-auto mb-3 h-8 w-8 text-text-muted"
            strokeWidth={1.25}
          />
          <p className="text-body font-medium text-text-primary">
            Nenhum check-in ainda
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Faça seu primeiro check-in hoje!
          </p>
          <Link
            href="/app/checkin"
            className="mt-4 inline-block rounded-lg bg-brand-primary px-4 py-2 text-caption font-semibold text-white"
          >
            Fazer check-in agora
          </Link>
        </div>
      ) : (
        <>
          {/* ── Calendário 35 dias ─────────────────────────────────── */}
          <section className="mt-6">
            <p className="mb-2 text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Últimas 5 semanas
            </p>
            {/* Day-of-week headers */}
            <div className="grid grid-cols-7 gap-1">
              {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
                <div
                  key={i}
                  className="text-center text-[9px] font-semibold uppercase text-text-muted"
                >
                  {d}
                </div>
              ))}
              {gridDays.map(({ iso, checkin }) => (
                <div
                  key={iso}
                  className="aspect-square rounded-md"
                  style={{
                    backgroundColor: moodBgColor(checkin?.mood ?? null),
                    opacity: checkin ? moodOpacity(checkin.mood) : 0.08,
                  }}
                  title={
                    checkin
                      ? `${iso} — humor ${checkin.mood != null ? MOOD_LABELS[checkin.mood - 1] : "não registrado"}`
                      : iso
                  }
                />
              ))}
            </div>
            {/* Legend */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-tiny text-text-muted">
              <span>Humor:</span>
              {MOOD_LABELS.map((label, i) => (
                <span key={label} className="flex items-center gap-0.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-sm"
                    style={{
                      backgroundColor: moodBgColor(i + 1),
                      opacity: moodOpacity(i + 1),
                    }}
                  />
                  {label}
                </span>
              ))}
            </div>
          </section>

          {/* ── Estatísticas ──────────────────────────────────────── */}
          <section className="mt-6 grid grid-cols-3 gap-3">
            <StatCard
              label="Total"
              value={String(total)}
              sublabel="check-ins"
            />
            {adherencePct != null && (
              <StatCard
                label="Aderência"
                value={`${adherencePct}%`}
                sublabel="ao plano"
                color={
                  adherencePct >= 80
                    ? "text-success"
                    : adherencePct >= 50
                      ? "text-warning"
                      : "text-danger"
                }
              />
            )}
            {avgMood != null && <AvgMoodCard avgMood={avgMood} />}
          </section>

          {/* ── Lista completa ───────────────────────────────────── */}
          <section className="mt-8">
            <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Todos os check-ins
            </h2>
            <ul className="mt-2 space-y-2">
              {checkins.map((c) => {
                const MoodIcon = c.mood ? MOOD_ICONS[c.mood - 1] : null;
                return (
                  <li
                    key={c.id}
                    className="rounded-xl border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-caption font-medium text-text-primary tabular-nums">
                        {fmtDate(c.checkinDate)}
                      </span>
                      <span className="flex items-center gap-2.5 text-tiny text-text-secondary">
                        {MoodIcon && (
                          <span className="flex items-center gap-1">
                            <MoodIcon
                              className="h-4 w-4 text-text-muted"
                              strokeWidth={1.75}
                              aria-label={
                                c.mood ? MOOD_LABELS[c.mood - 1] : undefined
                              }
                            />
                          </span>
                        )}
                        {c.waterMl != null && (
                          <span className="flex items-center gap-0.5 tabular-nums">
                            <Droplets
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              style={{ color: "var(--color-macro-water)" }}
                              aria-hidden="true"
                            />
                            {c.waterMl}ml
                          </span>
                        )}
                        {c.weightKg != null && (
                          <span className="flex items-center gap-0.5 tabular-nums">
                            <Scale
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            {Number(c.weightKg).toFixed(1)}kg
                          </span>
                        )}
                        {c.followedPlan === true && (
                          <span className="flex items-center gap-0.5 text-success">
                            <CircleCheck
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            plano
                          </span>
                        )}
                        {c.followedPlan === false && (
                          <span className="flex items-center gap-0.5 text-warning">
                            <TriangleAlert
                              className="h-3.5 w-3.5"
                              strokeWidth={1.75}
                              aria-hidden="true"
                            />
                            off-plan
                          </span>
                        )}
                      </span>
                    </div>
                    {/* Chips de energia/fome */}
                    {(c.energyLevel != null || c.hungerLevel != null) && (
                      <div className="mt-1.5 flex gap-2 text-tiny text-text-muted">
                        {c.energyLevel != null && (
                          <span className="rounded-full bg-bg-subtle px-2 py-0.5">
                            Energia {c.energyLevel}/5
                          </span>
                        )}
                        {c.hungerLevel != null && (
                          <span className="rounded-full bg-bg-subtle px-2 py-0.5">
                            Fome {c.hungerLevel}/5
                          </span>
                        )}
                      </div>
                    )}
                    {/* Notas */}
                    {c.notes && (
                      <p className="mt-1.5 text-tiny italic text-text-secondary">
                        "{c.notes}"
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

// ── Componentes auxiliares ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel: string;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-muted">{label}</p>
      <p
        className={`mt-0.5 text-h2 font-semibold tabular-nums ${color ?? "text-text-primary"}`}
      >
        {value}
      </p>
      <p className="text-tiny text-text-muted">{sublabel}</p>
    </div>
  );
}

function AvgMoodCard({ avgMood }: { avgMood: number }) {
  const idx = Math.round(avgMood) - 1;
  const MoodIcon = idx >= 0 && idx < MOOD_ICONS.length ? MOOD_ICONS[idx] : Meh;
  const label =
    idx >= 0 && idx < MOOD_LABELS.length ? MOOD_LABELS[idx] : "Médio";

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-muted">Humor médio</p>
      <p className="mt-0.5 flex items-center gap-1 text-h2 font-semibold text-text-primary">
        <MoodIcon className="h-5 w-5 text-text-secondary" strokeWidth={1.75} />
        {avgMood.toFixed(1)}
      </p>
      <p className="text-tiny text-text-muted">{label}</p>
    </div>
  );
}
