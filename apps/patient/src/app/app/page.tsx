import Link from "next/link";
import {
  CircleCheck,
  Flame,
  Hospital,
  Utensils,
  FileText,
  Calendar,
  MapPin,
  Video,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Início — NutriCore" };

function todayLocalISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const PLAN_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  DRAFT: "Rascunho",
  ARCHIVED: "Arquivado",
};

const MODALITY_INFO: Record<string, { Icon: LucideIcon; label: string }> = {
  in_person: { Icon: MapPin, label: "Presencial" },
  video: { Icon: Video, label: "Vídeo" },
  phone: { Icon: Phone, label: "Telefone" },
};

function formatApptDate(date: Date, tz: string): string {
  const nowStr = new Date().toLocaleDateString("pt-BR", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateStr = date.toLocaleDateString("pt-BR", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  // Compute diff in calendar days in the appointment's timezone
  const [nowD, nowM, nowY] = nowStr.split("/").map(Number) as [
    number,
    number,
    number,
  ];
  const [d, m, y] = dateStr.split("/").map(Number) as [number, number, number];
  const nowMidnight = new Date(nowY!, nowM! - 1, nowD!);
  const dateMidnight = new Date(y!, m! - 1, d!);
  const diffDays = Math.round(
    (dateMidnight.getTime() - nowMidnight.getTime()) / 86_400_000,
  );

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Amanhã";
  if (diffDays > 1 && diffDays <= 6)
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      timeZone: tz,
    });
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone: tz,
    year:
      new Date(y!, m! - 1, d!).getFullYear() !== new Date().getFullYear()
        ? "numeric"
        : undefined,
  });
}

export default async function PatientHomePage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { welcome } = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout já garante auth; aqui apenas leitura

  // Streak + check-in de hoje
  const todayDate = new Date(todayLocalISO() + "T12:00:00Z");
  const [streak, todayCheckin] = await Promise.all([
    prisma.userHealthStreak.findUnique({ where: { userId: user!.id } }),
    prisma.userHealthCheckin.findUnique({
      where: {
        userId_checkinDate: { userId: user!.id, checkinDate: todayDate },
      },
      select: { id: true },
    }),
  ]);

  // Lock 6 — Patient é User-scoped: encontre todos os Patient records vinculados a este user
  const patients = await prisma.patient.findMany({
    where: { userId: user!.id, status: { not: "ANONYMIZED" } },
    select: {
      id: true,
      fullName: true,
      preferredName: true,
      organization: { select: { id: true, name: true } },
      mealPlans: {
        where: { status: { in: ["ACTIVE", "DRAFT"] } },
        orderBy: { updatedAt: "desc" },
        take: 3,
        select: {
          id: true,
          name: true,
          status: true,
          targetKcal: true,
          updatedAt: true,
        },
      },
      clinicalDocuments: {
        where: { status: "ISSUED" },
        orderBy: { issuedAt: "desc" },
        take: 3,
        select: {
          id: true,
          title: true,
          documentType: true,
          issuedAt: true,
        },
      },
    },
  });

  // Próximas consultas — máx 3, janela de 30 dias
  const patientIds = patients.map((p) => p.id);
  const thirtyDaysOut = new Date(new Date().getTime() + 30 * 86_400_000);
  const upcomingAppointments = patientIds.length
    ? await prisma.appointment.findMany({
        where: {
          patientId: { in: patientIds },
          startsAt: { gte: new Date(), lte: thirtyDaysOut },
          status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN"] },
        },
        orderBy: { startsAt: "asc" },
        take: 3,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          modality: true,
          timezone: true,
          notes: true,
          organizationId: true,
        },
      })
    : [];

  // Mapear orgId → nome para as consultas
  const orgIds = Array.from(
    new Set(upcomingAppointments.map((a) => a.organizationId)),
  );
  const apptOrgs =
    orgIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        })
      : [];
  const orgMap = new Map(apptOrgs.map((o) => [o.id, o.name]));

  const isFirstTime = welcome === "1";

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      {isFirstTime && (
        <div className="mb-4 rounded-lg border border-success-border bg-success-bg p-4 text-caption text-success">
          <p className="flex items-center gap-2 font-semibold">
            <CircleCheck className="h-4 w-4" strokeWidth={2} />
            Boas-vindas à NutriCore!
          </p>
          <p className="mt-1 text-tiny">
            Seu acesso está pronto. Explore seu plano alimentar e fique de olho
            nos documentos enviados pela(o) sua(eu) nutricionista.
          </p>
        </div>
      )}

      <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
        {greeting()}
      </p>
      <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
        Olá
        {patients[0]?.preferredName ? `, ${patients[0].preferredName}` : ""}
      </h1>
      <p className="mt-1 text-caption text-text-secondary">
        Aqui está o resumo do seu acompanhamento nutricional.
      </p>

      {/* CTA check-in */}
      <div
        className={
          "mt-4 rounded-lg border p-4 " +
          (todayCheckin
            ? "border-success-border bg-success-bg"
            : "border-brand-300 bg-brand-primary-bg")
        }
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-body font-semibold text-text-primary">
              {todayCheckin && (
                <CircleCheck className="h-4 w-4 text-success" strokeWidth={2} />
              )}
              {todayCheckin ? "Check-in de hoje feito" : "Como foi seu dia?"}
            </p>
            {streak && streak.currentStreak > 0 && (
              <p className="mt-0.5 flex items-center gap-1 text-tiny tabular-nums text-warning">
                <Flame className="h-3.5 w-3.5" strokeWidth={2} />
                {streak.currentStreak} dia(s) seguidos
                {streak.longestStreak > streak.currentStreak &&
                  ` (recorde ${streak.longestStreak})`}
              </p>
            )}
          </div>
          <Link
            href="/app/checkin"
            className="shrink-0 rounded-md bg-brand-primary px-4 py-2 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98]"
          >
            {todayCheckin ? "Editar" : "Fazer check-in"}
          </Link>
        </div>
      </div>

      {/* Próximas consultas */}
      {upcomingAppointments.length > 0 && (
        <section className="mt-5">
          <h2 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            Próximas consultas
          </h2>
          <ul className="mt-2 space-y-2">
            {upcomingAppointments.map((a) => {
              const start = new Date(a.startsAt);
              const end = new Date(a.endsAt);
              const tz = a.timezone ?? "America/Sao_Paulo";
              const mod = MODALITY_INFO[a.modality];
              const isConfirmed = a.status === "CONFIRMED";
              const isCheckedIn = a.status === "CHECKED_IN";
              return (
                <li
                  key={a.id}
                  className={
                    "flex items-center gap-3 rounded-lg border px-4 py-3 [box-shadow:var(--shadow-xs)] " +
                    (isCheckedIn
                      ? "border-info-border bg-info-bg"
                      : isConfirmed
                        ? "border-brand-200 bg-brand-primary-bg"
                        : "border-border-subtle bg-bg-surface")
                  }
                >
                  {/* Date pill */}
                  <div className="flex min-w-[52px] flex-col items-center rounded-md bg-bg-subtle px-2 py-1.5 text-center">
                    <span className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      {start
                        .toLocaleDateString("pt-BR", {
                          month: "short",
                          timeZone: tz,
                        })
                        .slice(0, 3)}
                    </span>
                    <span className="text-h2 font-bold tabular-nums leading-none text-text-primary">
                      {start.toLocaleDateString("pt-BR", {
                        day: "numeric",
                        timeZone: tz,
                      })}
                    </span>
                  </div>
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-semibold tabular-nums text-text-primary">
                      {formatApptDate(start, tz)},{" "}
                      {start.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: tz,
                      })}
                      {" – "}
                      {end.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: tz,
                      })}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-tiny text-text-secondary">
                      {mod && (
                        <>
                          <mod.Icon
                            className="h-3 w-3"
                            strokeWidth={1.75}
                            aria-hidden
                          />
                          {mod.label} ·{" "}
                        </>
                      )}
                      {orgMap.get(a.organizationId) ?? "—"}
                    </p>
                    {isCheckedIn && (
                      <p className="mt-0.5 text-tiny font-medium text-info">
                        Em andamento
                      </p>
                    )}
                    {isConfirmed && (
                      <p className="mt-0.5 text-tiny font-medium text-brand-primary">
                        Confirmada
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <Link
            href="/app/consultas"
            className="mt-2 block text-right text-tiny font-medium text-brand-primary hover:underline"
          >
            Ver todas as consultas →
          </Link>
        </section>
      )}

      {patients.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
            <Hospital className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-h3 font-semibold text-text-primary">
            Sem profissional vinculado
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Peça à sua(seu) nutricionista um link de convite para conectar sua
            conta.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {patients.map((p) => (
            <section
              key={p.id}
              className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]"
            >
              <header className="flex items-center gap-3 border-b border-border-subtle pb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary">
                  <Hospital className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-h3 font-semibold text-text-primary">
                    {p.organization.name}
                  </h2>
                  <p className="text-tiny text-text-muted">
                    Registrado como: {p.fullName}
                  </p>
                </div>
              </header>

              {/* Planos */}
              <div className="mt-4">
                <h3 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                  <Utensils className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Planos alimentares ({p.mealPlans.length})
                </h3>
                {p.mealPlans.length === 0 ? (
                  <p className="mt-2 text-caption text-text-muted">
                    Nenhum plano ativo ainda.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {p.mealPlans.map((mp) => (
                      <li key={mp.id}>
                        <Link
                          href={`/app/meu-plano/${mp.id}`}
                          className="group flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2.5 text-body transition-all duration-fast hover:border-brand-primary hover:bg-brand-primary-bg/40"
                        >
                          <div>
                            <p className="font-medium text-text-primary group-hover:text-brand-primary">
                              {mp.name}
                            </p>
                            <p className="text-tiny text-text-muted tabular-nums">
                              {mp.targetKcal &&
                                `${Number(mp.targetKcal).toFixed(0)} kcal/dia · `}
                              Atualizado{" "}
                              {new Date(mp.updatedAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </p>
                          </div>
                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                              (mp.status === "ACTIVE"
                                ? "bg-success-bg text-success ring-success-border"
                                : "bg-warning-bg text-warning ring-warning-border")
                            }
                          >
                            {PLAN_STATUS_LABEL[mp.status] ?? mp.status}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Documentos */}
              {p.clinicalDocuments.length > 0 && (
                <div className="mt-4">
                  <h3 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Últimos documentos
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {p.clinicalDocuments.map((d) => (
                      <li
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2.5 text-body"
                      >
                        <div>
                          <p className="font-medium text-text-primary">
                            {d.title}
                          </p>
                          {d.issuedAt && (
                            <p className="text-tiny text-text-muted tabular-nums">
                              {new Date(d.issuedAt).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </div>
                        <Link
                          href={`/app/documentos/${d.id}`}
                          className="shrink-0 rounded-md border border-border-default px-3 py-1.5 text-tiny font-medium text-text-primary transition-colors hover:bg-bg-surface-hover"
                        >
                          Ver
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
