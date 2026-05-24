import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Users,
  Calendar,
  CalendarDays,
  Utensils,
  Wallet,
  FileText,
  Salad,
  Download,
  Settings,
  MapPin,
  Video,
  Phone,
  ChevronRight,
  AlertTriangle,
  Cake,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { MetricCard, NavCard } from "@/components/dashboard/MetricCard";
import { WelcomeTour } from "./WelcomeTour";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — NutriCore" };

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export default async function AppDashboard() {
  interface AgendaAppt {
    id: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    modality: string;
    timezone: string;
    patientName: string | null; // null = external patient
    externalPatientName: string | null;
  }

  let data: {
    org: { name: string; plan: string; subscriptionStatus: string };
    role: string;
    counts: {
      activePatients: number;
      apptsToday: number;
      apptsThisWeek: number;
      mealPlansActive: number;
      docsThisMonth: number;
      paymentsThisMonth: { count: number; totalCents: number };
    };
    sparks: {
      /** Daily appointment count, last 30 days (index 0 = oldest). */
      appts30d: number[];
      /** Daily revenue in cents, last 30 days (index 0 = oldest). */
      revenue30d: number[];
      /** Daily doc count, last 30 days. */
      docs30d: number[];
    };
    agendaHoje: AgendaAppt[];
    /** Active patients with app access who haven't checked in in 7+ days. */
    inactivePatients: Array<{
      id: string;
      fullName: string;
      /** Days since last check-in, or null if they've never checked in. */
      daysSince: number | null;
    }>;
    /** Active patients with a birthday in the next 7 days (inclusive). */
    birthdayPatients: Array<{
      id: string;
      fullName: string;
      /** 0 = today, 1 = tomorrow, etc. */
      daysUntil: number;
      /** Age they are turning on their birthday. */
      turnsAge: number;
    }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx, userId }) => {
      const now = new Date();
      const startOfToday = new Date(now);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(now);
      endOfToday.setHours(23, 59, 59, 999);

      const dayOfWeek = now.getDay(); // 0=sun
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - dayOfWeek);
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Spark window: 30 days ago at midnight
      const spark30Start = new Date(now);
      spark30Start.setDate(spark30Start.getDate() - 29);
      spark30Start.setHours(0, 0, 0, 0);

      const membership = await tx.membership.findFirst({
        where: { userId, status: "ACTIVE" },
        include: {
          organization: {
            select: {
              name: true,
              plan: true,
              subscriptionStatus: true,
            },
          },
        },
      });
      if (!membership) throw new ActionTenantError("Sem org", "NO_ORG");

      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Build birthday window: set of "M-D" strings for the next 7 days
      const birthdayWindow = new Set<string>();
      for (let i = 0; i <= 6; i++) {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() + i);
        birthdayWindow.add(`${d.getMonth() + 1}-${d.getDate()}`);
      }

      const [
        activePatients,
        apptsToday,
        apptsThisWeek,
        mealPlansActive,
        docsThisMonth,
        paymentsThisMonth,
        appts30dRaw,
        payments30dRaw,
        docs30dRaw,
        agendaHojeRaw,
        inactivePatientsResult,
        patientsWithBirthday,
      ] = await Promise.all([
        tx.patient.count({ where: { status: "ACTIVE" } }),
        tx.appointment.count({
          where: {
            professionalUserId: userId,
            startsAt: { gte: startOfToday, lte: endOfToday },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        tx.appointment.count({
          where: {
            professionalUserId: userId,
            startsAt: { gte: startOfWeek, lt: endOfWeek },
            status: { notIn: ["CANCELLED"] },
          },
        }),
        tx.mealPlan.count({
          where: { status: { in: ["ACTIVE", "DRAFT"] } },
        }),
        tx.clinicalDocument.count({
          where: {
            issuedByUserId: userId,
            createdAt: { gte: startOfMonth, lt: endOfMonth },
          },
        }),
        tx.patientPayment
          .aggregate({
            where: { paymentDate: { gte: startOfMonth, lt: endOfMonth } },
            _count: true,
            _sum: { amountCents: true },
          })
          .then(
            (r: { _count: number; _sum: { amountCents: number | null } }) => ({
              count: r._count,
              totalCents: r._sum.amountCents ?? 0,
            }),
          ),
        // Spark: appointments last 30 days
        tx.appointment.findMany({
          where: {
            professionalUserId: userId,
            startsAt: { gte: spark30Start, lte: endOfToday },
            status: { notIn: ["CANCELLED"] },
          },
          select: { startsAt: true },
        }),
        // Spark: payments last 30 days
        tx.patientPayment.findMany({
          where: { paymentDate: { gte: spark30Start, lte: endOfToday } },
          select: { paymentDate: true, amountCents: true },
        }),
        // Spark: docs last 30 days
        tx.clinicalDocument.findMany({
          where: {
            issuedByUserId: userId,
            createdAt: { gte: spark30Start, lte: endOfToday },
          },
          select: { createdAt: true },
        }),
        // Agenda do dia — todos os compromissos de hoje (incluindo cancelados para mostrar gaps)
        tx.appointment.findMany({
          where: {
            professionalUserId: userId,
            startsAt: { gte: startOfToday, lte: endOfToday },
          },
          orderBy: { startsAt: "asc" },
          take: 20,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            modality: true,
            timezone: true,
            externalPatientName: true,
            patient: { select: { fullName: true } },
          },
        }),
        // Inactive patients: two sequential sub-queries in one IIFE
        // (Patient → UserHealthStreak via userId key, no Prisma relation)
        (async () => {
          const patientsWithApp = await tx.patient.findMany({
            where: { status: "ACTIVE", userId: { not: null } },
            select: { id: true, fullName: true, userId: true },
            take: 200,
          });
          if (patientsWithApp.length === 0) return [];

          const userIds = patientsWithApp.map(
            (p: { userId: string | null }) => p.userId as string,
          );
          const streaks = await tx.userHealthStreak.findMany({
            where: { userId: { in: userIds } },
            select: { userId: true, lastCheckinDate: true },
          });
          const streakMap = new Map<string, Date | null>(
            streaks.map(
              (s: { userId: string; lastCheckinDate: Date | null }) =>
                [s.userId, s.lastCheckinDate] as [string, Date | null],
            ),
          );

          return patientsWithApp
            .filter(
              (p: { id: string; fullName: string; userId: string | null }) => {
                const last = streakMap.get(p.userId as string) ?? null;
                return !last || last < sevenDaysAgo;
              },
            )
            .sort(
              (a: { userId: string | null }, b: { userId: string | null }) => {
                const da = streakMap.get(a.userId as string) ?? null;
                const db = streakMap.get(b.userId as string) ?? null;
                if (!da && !db) return 0;
                if (!da) return -1; // never checked in → top of list
                if (!db) return 1;
                return da.getTime() - db.getTime();
              },
            )
            .slice(0, 6)
            .map(
              (p: { id: string; fullName: string; userId: string | null }) => {
                const last = streakMap.get(p.userId as string) ?? null;
                const daysSince = last
                  ? Math.floor((now.getTime() - last.getTime()) / 86_400_000)
                  : null;
                return { id: p.id, fullName: p.fullName, daysSince };
              },
            );
        })(),
        // Fetch active patients with a known birthDate — filter by window in JS
        tx.patient.findMany({
          where: { status: "ACTIVE", birthDate: { not: null } },
          select: { id: true, fullName: true, birthDate: true },
        }),
      ]);

      // Build daily spark arrays (index 0 = 29 days ago, index 29 = today)
      function buildDailyCount(dates: Date[], days = 30): number[] {
        const counts = new Array(days).fill(0) as number[];
        const msNow = startOfToday.getTime();
        for (const d of dates) {
          const diff = Math.floor(
            (msNow - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000,
          );
          const idx = days - 1 - diff;
          if (idx >= 0 && idx < days) counts[idx]++;
        }
        return counts;
      }

      function buildDailySum(
        records: Array<{ paymentDate: Date; amountCents: number }>,
        days = 30,
      ): number[] {
        const sums = new Array(days).fill(0) as number[];
        const msNow = startOfToday.getTime();
        for (const r of records) {
          const diff = Math.floor(
            (msNow - new Date(r.paymentDate).setHours(0, 0, 0, 0)) / 86_400_000,
          );
          const idx = days - 1 - diff;
          if (idx >= 0 && idx < days) sums[idx] += r.amountCents;
        }
        return sums;
      }

      return {
        org: membership.organization,
        role: membership.role,
        counts: {
          activePatients,
          apptsToday,
          apptsThisWeek,
          mealPlansActive,
          docsThisMonth,
          paymentsThisMonth,
        },
        sparks: {
          appts30d: buildDailyCount(
            appts30dRaw.map((a: { startsAt: Date }) => a.startsAt),
          ),
          revenue30d: buildDailySum(
            payments30dRaw.map(
              (p: { paymentDate: Date; amountCents: number }) => p,
            ),
          ),
          docs30d: buildDailyCount(
            docs30dRaw.map((d: { createdAt: Date }) => d.createdAt),
          ),
        },
        inactivePatients: inactivePatientsResult,
        birthdayPatients: (
          patientsWithBirthday as Array<{
            id: string;
            fullName: string;
            birthDate: Date;
          }>
        )
          .filter((p) => {
            const bd = p.birthDate;
            return birthdayWindow.has(`${bd.getMonth() + 1}-${bd.getDate()}`);
          })
          .map((p) => {
            const bd = p.birthDate;
            // Compute daysUntil using "this year's birthday" (or next year at Dec/Jan crossover)
            let birthday = new Date(
              now.getFullYear(),
              bd.getMonth(),
              bd.getDate(),
            );
            // If birthday already passed this year, check next year
            if (birthday < startOfToday) {
              birthday = new Date(
                now.getFullYear() + 1,
                bd.getMonth(),
                bd.getDate(),
              );
            }
            const daysUntil = Math.round(
              (birthday.getTime() - startOfToday.getTime()) / 86_400_000,
            );
            const turnsAge = birthday.getFullYear() - bd.getFullYear();
            return { id: p.id, fullName: p.fullName, daysUntil, turnsAge };
          })
          .sort((a, b) => a.daysUntil - b.daysUntil),
        agendaHoje: agendaHojeRaw.map(
          (a: {
            id: string;
            startsAt: Date;
            endsAt: Date;
            status: string;
            modality: string;
            timezone: string;
            externalPatientName: string | null;
            patient: { fullName: string } | null;
          }) => ({
            id: a.id,
            startsAt: a.startsAt,
            endsAt: a.endsAt,
            status: a.status,
            modality: a.modality,
            timezone: a.timezone,
            patientName: a.patient?.fullName ?? null,
            externalPatientName: a.externalPatientName,
          }),
        ),
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!data) return null;

  const totalAppts =
    data.counts.apptsToday +
    (data.counts.apptsThisWeek - data.counts.apptsToday);

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl">
        {/* Hero header — saudação contextual + org info */}
        <header className="mb-6">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            {greeting()}
          </p>
          <h1 className="mt-1 text-display font-semibold tracking-tight text-text-primary">
            {data.org.name}
          </h1>
          <p className="mt-2 text-caption text-text-secondary">
            Você tem{" "}
            <span className="font-medium text-text-primary tabular-nums">
              {data.counts.apptsToday}
            </span>{" "}
            consulta{data.counts.apptsToday !== 1 ? "s" : ""} hoje
            {data.counts.mealPlansActive > 0 && (
              <>
                {" "}
                e{" "}
                <span className="font-medium text-text-primary tabular-nums">
                  {data.counts.mealPlansActive}
                </span>{" "}
                plano{data.counts.mealPlansActive !== 1 ? "s ativos" : " ativo"}
              </>
            )}
            .
          </p>
        </header>

        <WelcomeTour />

        {/* KPIs — MetricCards animados */}
        <section
          aria-label="Métricas principais"
          className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
        >
          <MetricCard
            label="Pacientes ativos"
            value={data.counts.activePatients}
            icon={<Users strokeWidth={1.75} />}
            href="/app/patients"
            sub={data.counts.activePatients === 1 ? "1 ativo" : "total ativos"}
          />
          <MetricCard
            label="Consultas hoje"
            value={data.counts.apptsToday}
            icon={<Calendar strokeWidth={1.75} />}
            href="/app/agenda"
            sub="agendadas hoje"
            sparkData={data.sparks.appts30d}
          />
          <MetricCard
            label="Consultas semana"
            value={data.counts.apptsThisWeek}
            icon={<CalendarDays strokeWidth={1.75} />}
            href="/app/agenda"
            sub={`${totalAppts >= data.counts.apptsThisWeek ? "" : "+ extras"}`}
            sparkData={data.sparks.appts30d}
          />
          <MetricCard
            label="Planos ativos"
            value={data.counts.mealPlansActive}
            icon={<Utensils strokeWidth={1.75} />}
            href="/app/patients"
            sub="em andamento"
          />
          <MetricCard
            label="Receita do mês"
            prefix="R$"
            value={data.counts.paymentsThisMonth.totalCents / 100}
            decimals={2}
            icon={<Wallet strokeWidth={1.75} />}
            href="/app/financeiro"
            sub={`${data.counts.paymentsThisMonth.count} pagamento${data.counts.paymentsThisMonth.count !== 1 ? "s" : ""}`}
            sparkData={data.sparks.revenue30d.map((c) => c / 100)}
            sparkColor="var(--color-success)"
          />
          <MetricCard
            label="Docs do mês"
            value={data.counts.docsThisMonth}
            icon={<FileText strokeWidth={1.75} />}
            href="/app/patients"
            sub="emitidos no mês"
            sparkData={data.sparks.docs30d}
          />
        </section>

        {/* Agenda do dia */}
        <section aria-label="Agenda de hoje" className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-h2 font-semibold text-text-primary">
              Agenda de hoje
            </h2>
            <Link
              href="/app/agenda"
              className="inline-flex items-center gap-0.5 text-caption text-brand-primary transition-colors hover:text-brand-primary-hover"
            >
              Ver agenda completa
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          </div>

          {data.agendaHoje.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-6 text-center">
              <Calendar
                className="mx-auto h-8 w-8 text-text-muted"
                strokeWidth={1.5}
              />
              <p className="mt-2 text-body font-medium text-text-secondary">
                Nenhuma consulta agendada para hoje
              </p>
              <Link
                href="/app/agenda"
                className="mt-3 inline-block text-caption text-brand-primary hover:underline"
              >
                Agendar consulta →
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.agendaHoje.map((appt) => {
                const displayName =
                  appt.patientName ?? appt.externalPatientName ?? "Paciente";
                const isCancelled = appt.status === "CANCELLED";
                const isCompleted = appt.status === "COMPLETED";
                const isNoShow = appt.status === "NO_SHOW";
                const isDimmed = isCancelled || isNoShow;

                const statusConfig: Record<
                  string,
                  { label: string; cls: string }
                > = {
                  SCHEDULED: {
                    label: "Agendado",
                    cls: "bg-info-bg text-info ring-info-border",
                  },
                  CONFIRMED: {
                    label: "Confirmado",
                    cls: "bg-brand-primary-bg text-brand-primary ring-brand-primary/20",
                  },
                  CHECKED_IN: {
                    label: "Check-in",
                    cls: "bg-info-bg text-info ring-info-border",
                  },
                  COMPLETED: {
                    label: "Realizada",
                    cls: "bg-success-bg text-success ring-success-border",
                  },
                  CANCELLED: {
                    label: "Cancelada",
                    cls: "bg-bg-subtle text-text-muted ring-border-subtle",
                  },
                  NO_SHOW: {
                    label: "No-show",
                    cls: "bg-danger-bg text-danger ring-danger-border",
                  },
                };
                const sc = statusConfig[appt.status] ?? {
                  label: appt.status,
                  cls: "bg-bg-subtle text-text-muted ring-border-subtle",
                };

                const ModalityIcon =
                  appt.modality === "video"
                    ? Video
                    : appt.modality === "phone"
                      ? Phone
                      : MapPin;

                return (
                  <li key={appt.id}>
                    <Link
                      href="/app/agenda"
                      className={[
                        "flex items-center gap-3 rounded-lg border bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)] transition-all duration-fast",
                        isDimmed
                          ? "border-border-subtle opacity-60"
                          : "border-border-subtle hover:border-brand-primary hover:[box-shadow:var(--shadow-sm)]",
                      ].join(" ")}
                    >
                      {/* Time column */}
                      <div className="w-14 shrink-0 text-right">
                        <p
                          className={[
                            "text-body font-semibold tabular-nums",
                            isDimmed ? "text-text-muted" : "text-text-primary",
                          ].join(" ")}
                        >
                          {new Date(appt.startsAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: appt.timezone,
                          })}
                        </p>
                        <p className="text-tiny tabular-nums text-text-muted">
                          {new Date(appt.endsAt).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: appt.timezone,
                          })}
                        </p>
                      </div>

                      {/* Divider */}
                      <div
                        className={[
                          "h-8 w-px shrink-0",
                          isDimmed
                            ? "bg-border-subtle"
                            : isCompleted
                              ? "bg-success"
                              : "bg-brand-primary",
                        ].join(" ")}
                      />

                      {/* Patient + modality */}
                      <div className="min-w-0 flex-1">
                        <p
                          className={[
                            "truncate text-body font-medium",
                            isDimmed
                              ? "text-text-muted line-through"
                              : "text-text-primary",
                          ].join(" ")}
                        >
                          {displayName}
                        </p>
                        <p className="mt-0.5 inline-flex items-center gap-1 text-tiny text-text-muted">
                          <ModalityIcon
                            className="h-3 w-3"
                            strokeWidth={1.75}
                          />
                          {appt.modality === "video"
                            ? "Videoconferência"
                            : appt.modality === "phone"
                              ? "Telefone"
                              : "Presencial"}
                        </p>
                      </div>

                      {/* Status badge */}
                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset",
                          sc.cls,
                        ].join(" ")}
                      >
                        {sc.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Pacientes para acompanhar — sem check-in em 7+ dias */}
        {data.inactivePatients.length > 0 && (
          <section aria-label="Pacientes para acompanhar" className="mt-10">
            <div className="mb-4 flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-h2 font-semibold text-text-primary">
                  Para acompanhar
                </h2>
                <span className="rounded-full bg-warning-bg px-2 py-0.5 text-tiny font-medium text-warning ring-1 ring-inset ring-warning-border">
                  {data.inactivePatients.length}
                </span>
              </div>
              <Link
                href="/app/patients"
                className="inline-flex items-center gap-0.5 text-caption text-brand-primary transition-colors hover:text-brand-primary-hover"
              >
                Ver todos os pacientes
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>
            <p className="mb-3 text-tiny text-text-muted">
              Pacientes com acesso ao app que não registraram check-in nos
              últimos 7 dias.
            </p>

            <ul className="space-y-2">
              {data.inactivePatients.map((patient) => {
                const daysLabel =
                  patient.daysSince === null
                    ? "nunca fez check-in"
                    : patient.daysSince === 0
                      ? "último check-in: hoje"
                      : patient.daysSince === 1
                        ? "há 1 dia sem check-in"
                        : `há ${patient.daysSince} dias sem check-in`;

                const isVeryInactive =
                  patient.daysSince === null || patient.daysSince >= 14;

                return (
                  <li key={patient.id}>
                    <Link
                      href={`/app/patients/${patient.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)] transition-all duration-fast hover:border-brand-primary hover:[box-shadow:var(--shadow-sm)]"
                    >
                      {/* Alert icon */}
                      <AlertTriangle
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.75}
                        style={{
                          color: isVeryInactive
                            ? "var(--color-danger)"
                            : "var(--color-warning)",
                        }}
                      />

                      {/* Patient name */}
                      <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
                        {patient.fullName}
                      </span>

                      {/* Days badge */}
                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset tabular-nums",
                          isVeryInactive
                            ? "bg-danger-bg text-danger ring-danger-border"
                            : "bg-warning-bg text-warning ring-warning-border",
                        ].join(" ")}
                      >
                        {daysLabel}
                      </span>

                      <ChevronRight
                        className="h-3.5 w-3.5 shrink-0 text-text-muted"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Aniversários esta semana */}
        {data.birthdayPatients.length > 0 && (
          <section aria-label="Aniversários esta semana" className="mt-10">
            <div className="mb-4 flex items-baseline justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-h2 font-semibold text-text-primary">
                  Aniversários esta semana
                </h2>
                <span className="rounded-full bg-brand-primary-bg px-2 py-0.5 text-tiny font-medium text-brand-primary ring-1 ring-inset ring-brand-primary-border">
                  {data.birthdayPatients.length}
                </span>
              </div>
            </div>

            <ul className="space-y-2">
              {data.birthdayPatients.map((patient) => {
                const isToday = patient.daysUntil === 0;
                const isTomorrow = patient.daysUntil === 1;
                const whenLabel = isToday
                  ? "hoje!"
                  : isTomorrow
                    ? "amanhã"
                    : `em ${patient.daysUntil} dias`;

                return (
                  <li key={patient.id}>
                    <Link
                      href={`/app/patients/${patient.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-xs)] transition-all duration-fast hover:border-brand-primary hover:[box-shadow:var(--shadow-sm)]"
                    >
                      <Cake
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.75}
                        style={{
                          color: isToday
                            ? "var(--color-brand-primary)"
                            : "var(--color-text-secondary)",
                        }}
                      />

                      <span className="min-w-0 flex-1 truncate text-body font-medium text-text-primary">
                        {patient.fullName}
                      </span>

                      <span className="shrink-0 text-tiny text-text-secondary">
                        {patient.turnsAge} anos
                      </span>

                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset",
                          isToday
                            ? "bg-brand-primary-bg text-brand-primary ring-brand-primary-border"
                            : "bg-bg-subtle text-text-secondary ring-border-subtle",
                        ].join(" ")}
                      >
                        {whenLabel}
                      </span>

                      <ChevronRight
                        className="h-3.5 w-3.5 shrink-0 text-text-muted"
                        strokeWidth={2}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Nav cards — seções principais */}
        <section aria-label="Atalhos" className="mt-10">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-h2 font-semibold text-text-primary">Atalhos</h2>
            <p className="text-caption text-text-muted">
              Pressione{" "}
              <kbd className="rounded border border-border-subtle bg-bg-muted px-1.5 py-0.5 font-mono text-tiny font-medium text-text-secondary">
                ⌘K
              </kbd>{" "}
              para busca rápida
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <NavCard
              href="/app/patients"
              title="Pacientes"
              description="Cadastro, anamnese, planos, check-ins, documentos."
              icon={<Users strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/agenda"
              title="Agenda"
              description="Consultas, check-in, conclusão com recibo."
              icon={<Calendar strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/financeiro"
              title="Financeiro"
              description="Pagamentos registrados, faturamento por mês."
              icon={<Wallet strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/alimentos"
              title="Alimentos & Receitas"
              description="Biblioteca TACO/POF + receitas próprias."
              icon={<Salad strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/imports"
              title="Importar pacientes"
              description="Migrar de Dietbox, Webdiet ou CSV genérico."
              icon={<Download strokeWidth={1.75} />}
            />
            <NavCard
              href="/app/settings"
              title="Configurações"
              description="Branding, nome no email, dados da org."
              icon={<Settings strokeWidth={1.75} />}
            />
          </div>
        </section>

        {/* Status meta — plano + role (footer sutil) */}
        <p className="mt-10 text-tiny text-text-muted">
          Plano:{" "}
          <span className="font-medium text-text-secondary">
            {data.org.plan}
          </span>{" "}
          · Status:{" "}
          <span className="font-medium text-text-secondary">
            {data.org.subscriptionStatus}
          </span>{" "}
          · Sua role:{" "}
          <span className="font-medium text-text-secondary">{data.role}</span>
        </p>
      </div>
    </main>
  );
}
