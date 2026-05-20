import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, LayoutGrid, List } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { AppointmentList } from "./AppointmentList";
import { NewAppointmentForm } from "./NewAppointmentForm";
import { WeekCalendar } from "./WeekCalendar";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

interface Props {
  searchParams: Promise<{ date?: string; view?: string; patientId?: string }>;
}

/** Returns the Monday of the week containing `date`. */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

export default async function AgendaPage({ searchParams }: Props) {
  const {
    date,
    view = "day",
    patientId: defaultPatientId,
  } = await searchParams;
  const isWeekView = view === "week";

  const targetDate = date ? new Date(date + "T00:00:00") : new Date();
  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDateStr = targetDate.toISOString().slice(0, 10);
  const isToday = targetDateStr === todayStr;

  const weekStart = getWeekStart(targetDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  // ── Day-view window ─────────────────────────────────────────────────────
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // ── Navigation dates ─────────────────────────────────────────────────────
  const prevDay = new Date(targetDate);
  prevDay.setDate(prevDay.getDate() - 1);
  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  const prevWeek = new Date(weekStart);
  prevWeek.setDate(prevWeek.getDate() - 7);
  const nextWeek = new Date(weekStart);
  nextWeek.setDate(nextWeek.getDate() + 7);

  let data: {
    appointments: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
      modality: string;
      patientId: string | null;
      patientName: string | null;
      externalPatientName: string | null;
      notes: string | null;
    }>;
    patients: Array<{ id: string; fullName: string }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx, userId }) => {
      const fetchStart = isWeekView ? weekStart : startOfDay;
      const fetchEnd = isWeekView ? weekEnd : endOfDay;

      const appointments = await tx.appointment.findMany({
        where: {
          professionalUserId: userId,
          startsAt: { gte: fetchStart, lte: fetchEnd },
        },
        orderBy: { startsAt: "asc" },
        take: 500,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          modality: true,
          externalPatientName: true,
          notes: true,
          patientId: true,
        },
      });

      const patientIds = appointments
        .map((a: { patientId: string | null }) => a.patientId)
        .filter((id: string | null): id is string => id !== null);

      const patients = await tx.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, fullName: true },
      });

      const patientMap = new Map<string, string>(
        patients.map((p: { id: string; fullName: string }) => [
          p.id,
          p.fullName,
        ]),
      );

      const enriched = appointments.map(
        (a: (typeof appointments)[number] & { patientId: string | null }) => ({
          ...a,
          patientName: a.patientId
            ? (patientMap.get(a.patientId) ?? null)
            : null,
        }),
      );

      const activePatients = await tx.patient.findMany({
        where: { status: "ACTIVE" },
        orderBy: { fullName: "asc" },
        take: 200,
        select: { id: true, fullName: true },
      });

      return { appointments: enriched, patients: activePatients };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!data) return null;

  // ── Labels ───────────────────────────────────────────────────────────────
  const dayLabel = targetDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndDisplay = new Date(weekEnd);
  weekEndDisplay.setDate(weekEndDisplay.getDate() - 1);
  const weekLabel =
    weekStart.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }) +
    " – " +
    weekEndDisplay.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const activeThisWeek = isWeekView
    ? data.appointments.filter((a) => a.status !== "CANCELLED").length
    : null;

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* ── Header ── */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              {isWeekView ? "Vista semanal" : isToday ? "Hoje" : "Agenda"}
            </p>
            <h1 className="mt-0.5 text-h1 font-semibold capitalize tracking-tight text-text-primary">
              {isWeekView ? weekLabel : dayLabel}
            </h1>
            <p className="mt-1 text-caption text-text-secondary tabular-nums">
              {isWeekView ? (
                <>
                  <span className="font-medium text-text-primary">
                    {activeThisWeek}
                  </span>{" "}
                  {activeThisWeek === 1 ? "consulta" : "consultas"} esta semana
                </>
              ) : (
                <>
                  <span className="font-medium text-text-primary tabular-nums">
                    {data.appointments.length}
                  </span>{" "}
                  {data.appointments.length === 1 ? "consulta" : "consultas"}{" "}
                  agendada{data.appointments.length !== 1 ? "s" : ""}
                </>
              )}
            </p>
          </div>

          {/* Controls: view toggle + nav */}
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <nav
              aria-label="Vista"
              className="inline-flex items-center rounded-md border border-border-default bg-bg-surface p-0.5 [box-shadow:var(--shadow-xs)]"
            >
              <Link
                href={`/app/agenda?date=${targetDateStr}&view=day`}
                aria-label="Vista dia"
                className={
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm px-3 text-tiny font-medium transition-colors " +
                  (!isWeekView
                    ? "bg-bg-subtle text-text-primary [box-shadow:var(--shadow-xs)]"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
                }
              >
                <List className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
                Dia
              </Link>
              <Link
                href={`/app/agenda?date=${targetDateStr}&view=week`}
                aria-label="Vista semana"
                className={
                  "inline-flex h-8 items-center justify-center gap-1.5 rounded-sm px-3 text-tiny font-medium transition-colors " +
                  (isWeekView
                    ? "bg-bg-subtle text-text-primary [box-shadow:var(--shadow-xs)]"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
                }
              >
                <LayoutGrid
                  className="h-3.5 w-3.5"
                  strokeWidth={1.75}
                  aria-hidden
                />
                Semana
              </Link>
            </nav>

            {/* Date / week navigation */}
            <nav
              aria-label="Navegação"
              className="inline-flex items-center rounded-md border border-border-default bg-bg-surface p-0.5 [box-shadow:var(--shadow-xs)]"
            >
              <Link
                href={
                  isWeekView
                    ? `/app/agenda?date=${prevWeek.toISOString().slice(0, 10)}&view=week`
                    : `/app/agenda?date=${prevDay.toISOString().slice(0, 10)}&view=day`
                }
                aria-label={isWeekView ? "Semana anterior" : "Dia anterior"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
              </Link>
              <Link
                href={
                  isWeekView
                    ? `/app/agenda?date=${todayStr}&view=week`
                    : `/app/agenda?date=${todayStr}&view=day`
                }
                className={
                  "inline-flex h-8 items-center justify-center rounded-sm px-3 text-tiny font-medium transition-colors " +
                  (isToday && !isWeekView
                    ? "bg-brand-primary text-white"
                    : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
                }
              >
                Hoje
              </Link>
              <Link
                href={
                  isWeekView
                    ? `/app/agenda?date=${nextWeek.toISOString().slice(0, 10)}&view=week`
                    : `/app/agenda?date=${nextDay.toISOString().slice(0, 10)}&view=day`
                }
                aria-label={isWeekView ? "Próxima semana" : "Próximo dia"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
              </Link>
            </nav>
          </div>
        </header>

        {/* ── Content ── */}
        {isWeekView ? (
          /* Week view: full-width calendar */
          <div className="space-y-4">
            <WeekCalendar
              appointments={data.appointments}
              weekStart={weekStartStr}
              todayStr={todayStr}
            />
            <p className="text-center text-tiny text-text-muted">
              Clique em um dia para ver detalhes e agendar consultas
            </p>
          </div>
        ) : (
          /* Day view: list + form */
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <AppointmentList appointments={data.appointments} />
            </div>
            <div>
              <NewAppointmentForm
                patients={data.patients}
                defaultDate={targetDate}
                defaultPatientId={defaultPatientId}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
