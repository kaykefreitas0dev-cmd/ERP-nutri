import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { CheckinMiniCharts } from "./CheckinMiniCharts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Check-ins do paciente" };

interface Props {
  params: Promise<{ id: string }>;
}

const MOOD_ICONS: LucideIcon[] = [Frown, Annoyed, Meh, Smile, SmilePlus];

export default async function PatientCheckinsPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string; userId: string | null };
    checkins: Array<{
      id: string;
      checkinDate: Date;
      mood: number | null;
      energyLevel: number | null;
      hungerLevel: number | null;
      waterMl: number | null;
      weightKg: { toString: () => string } | null;
      followedPlan: boolean | null;
      notes: string | null;
    }>;
    streak: {
      currentStreak: number;
      longestStreak: number;
      totalCheckins: number;
      lastCheckinDate: Date | null;
    } | null;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true, userId: true },
      });
      if (!patient) return null;

      if (!patient.userId) {
        return { patient, checkins: [], streak: null };
      }

      // Lock 6 + RLS policy "user_checkins_nutri_read" permite leitura
      // pelo nutri se houver Patient na org com user_id casando
      const [checkins, streak] = await Promise.all([
        tx.userHealthCheckin.findMany({
          where: { userId: patient.userId },
          orderBy: { checkinDate: "desc" },
          take: 60,
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
        tx.userHealthStreak.findUnique({
          where: { userId: patient.userId },
          select: {
            currentStreak: true,
            longestStreak: true,
            totalCheckins: true,
            lastCheckinDate: true,
          },
        }),
      ]);

      return { patient, checkins, streak };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();
  const { patient, checkins, streak } = data;

  // Calcular médias (últimos 30 dias)
  const last30 = checkins.slice(0, 30);
  const avgMood = avg(last30.map((c) => c.mood));
  const avgEnergy = avg(last30.map((c) => c.energyLevel));
  const avgWater = avg(last30.map((c) => c.waterMl));
  const followedRate = last30.filter((c) => c.followedPlan === true).length;
  const totalWithPlan = last30.filter((c) => c.followedPlan !== null).length;

  // Sparkline arrays — chronological (oldest first) from last 30
  const chronLast30 = [...last30].reverse();
  const moodSpark = chronLast30
    .map((c) => c.mood)
    .filter((v): v is number => v !== null);
  const energySpark = chronLast30
    .map((c) => c.energyLevel)
    .filter((v): v is number => v !== null);
  const waterSpark = chronLast30
    .map((c) => c.waterMl)
    .filter((v): v is number => v !== null);
  const weightSpark = chronLast30
    .map((c) => (c.weightKg ? parseFloat(c.weightKg.toString()) : null))
    .filter((v): v is number => v !== null);

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="text-body text-brand-primary hover:underline"
        >
          ← {patient.fullName}
        </Link>
        <h1 className="mt-2 text-h1 font-bold text-text-primary">
          Check-ins do paciente
        </h1>

        {!patient.userId ? (
          <div className="mt-6 rounded-lg border border-warning-border bg-warning-bg p-4 text-body text-warning">
            Este paciente ainda não acessou o app. Envie um convite na página
            principal para que ele possa começar a registrar check-ins.
          </div>
        ) : (
          <>
            {/* Resumo */}
            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Streak atual"
                value={
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Flame
                      className="h-5 w-5"
                      strokeWidth={1.75}
                      style={{ color: "var(--color-warning)" }}
                    />
                    {streak?.currentStreak ?? 0}d
                  </span>
                }
                sub={`recorde ${streak?.longestStreak ?? 0}d`}
              />
              <StatCard
                label="Total check-ins"
                value={`${streak?.totalCheckins ?? 0}`}
                sub="histórico"
              />
              <StatCard
                label="Aderência ao plano (30d)"
                value={
                  totalWithPlan > 0
                    ? `${Math.round((followedRate / totalWithPlan) * 100)}%`
                    : "—"
                }
                sub={`${followedRate}/${totalWithPlan} dias`}
              />
              <StatCard
                label="Humor médio (30d)"
                value={
                  avgMood
                    ? (() => {
                        const Icon = MOOD_ICONS[Math.round(avgMood) - 1] ?? Meh;
                        return (
                          <Icon
                            className="inline-block h-6 w-6 text-text-secondary"
                            strokeWidth={1.75}
                          />
                        );
                      })()
                    : "—"
                }
                sub={avgMood ? avgMood.toFixed(1) + "/5" : "sem dados"}
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                label="Energia média (30d)"
                value={avgEnergy ? avgEnergy.toFixed(1) + "/5" : "—"}
                sub=""
              />
              <StatCard
                label="Água média (30d)"
                value={avgWater ? `${Math.round(avgWater)}ml` : "—"}
                sub="por dia"
              />
              <StatCard
                label="Último check-in"
                value={
                  streak?.lastCheckinDate
                    ? new Date(streak.lastCheckinDate).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"
                }
                sub=""
              />
              <StatCard
                label="Dias monitorados"
                value={`${checkins.length}`}
                sub="últimos 60 dias"
              />
            </div>

            {/* Gráficos de tendência */}
            <CheckinMiniCharts
              moodData={moodSpark}
              energyData={energySpark}
              waterData={waterSpark}
              weightData={weightSpark}
            />

            {/* Tabela detalhada */}
            <section className="mt-8 rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
              <header className="border-b border-border-subtle px-5 py-3">
                <h2 className="text-h3 font-semibold">
                  Histórico ({checkins.length})
                </h2>
              </header>
              {checkins.length === 0 ? (
                <p className="p-5 text-body text-text-muted">
                  Nenhum check-in registrado ainda.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-body">
                    <thead className="border-b border-border-subtle bg-bg-subtle text-tiny uppercase tracking-wider text-text-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Data</th>
                        <th className="px-4 py-2 text-center">Humor</th>
                        <th className="px-4 py-2 text-center">Energia</th>
                        <th className="px-4 py-2 text-center">Fome</th>
                        <th className="px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Droplets
                              className="h-3 w-3"
                              strokeWidth={2}
                              style={{ color: "var(--color-macro-water)" }}
                            />
                            Água
                          </span>
                        </th>
                        <th className="px-4 py-2 text-right">
                          <span className="inline-flex items-center justify-end gap-1">
                            <Scale className="h-3 w-3" strokeWidth={2} />
                            Peso
                          </span>
                        </th>
                        <th className="px-4 py-2 text-center">Plano</th>
                        <th className="px-4 py-2 text-left">Notas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {checkins.map((c) => (
                        <tr key={c.id} className="hover:bg-bg-subtle">
                          <td className="px-4 py-2 text-tiny">
                            {new Date(c.checkinDate).toLocaleDateString(
                              "pt-BR",
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {c.mood
                              ? (() => {
                                  const Icon = MOOD_ICONS[c.mood - 1] ?? Meh;
                                  return (
                                    <Icon
                                      className="inline-block h-4 w-4 text-text-secondary"
                                      strokeWidth={1.75}
                                    />
                                  );
                                })()
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-center text-tiny">
                            {c.energyLevel ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-center text-tiny">
                            {c.hungerLevel ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-tiny">
                            {c.waterMl != null ? `${c.waterMl}ml` : "—"}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-tiny">
                            {c.weightKg
                              ? `${Number(c.weightKg).toFixed(1)}kg`
                              : "—"}
                          </td>
                          <td className="px-4 py-2 text-center text-tiny">
                            {c.followedPlan === true && (
                              <CircleCheck
                                className="inline-block h-3.5 w-3.5 text-success"
                                strokeWidth={1.75}
                              />
                            )}
                            {c.followedPlan === false && (
                              <TriangleAlert
                                className="inline-block h-3.5 w-3.5 text-warning"
                                strokeWidth={1.75}
                              />
                            )}
                            {c.followedPlan === null && "—"}
                          </td>
                          <td className="max-w-xs truncate px-4 py-2 text-tiny text-text-secondary">
                            {c.notes ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-muted">{label}</p>
      <p className="mt-1 text-h2 font-bold text-text-primary">{value}</p>
      {sub && <p className="text-tiny text-text-muted">{sub}</p>}
    </div>
  );
}

function avg(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
