import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { AppointmentList } from "./AppointmentList";
import { NewAppointmentForm } from "./NewAppointmentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda" };

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function AgendaPage({ searchParams }: Props) {
  const { date } = await searchParams;
  const targetDate = date ? new Date(date) : new Date();
  // Início e fim do dia (UTC para Postgres; UI converte para tz)
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

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
      const appointments = await tx.appointment.findMany({
        where: {
          professionalUserId: userId,
          startsAt: { gte: startOfDay, lte: endOfDay },
        },
        orderBy: { startsAt: "asc" },
        take: 100,
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

      // Carregar pacientes ativos para o form
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

  const dateStr = targetDate.toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prevDate = new Date(targetDate);
  prevDate.setDate(prevDate.getDate() - 1);
  const nextDate = new Date(targetDate);
  nextDate.setDate(nextDate.getDate() + 1);
  const todayStr = new Date().toISOString().slice(0, 10);
  const isToday = targetDate.toISOString().slice(0, 10) === todayStr;

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              {isToday ? "Hoje" : "Agenda"}
            </p>
            <h1 className="mt-0.5 text-h1 font-semibold capitalize tracking-tight text-text-primary">
              {dateStr}
            </h1>
            <p className="mt-1 text-caption text-text-secondary tabular-nums">
              {data.appointments.length}{" "}
              {data.appointments.length === 1 ? "consulta" : "consultas"}{" "}
              agendada{data.appointments.length === 1 ? "" : "s"}
            </p>
          </div>

          {/* Date navigation segmented */}
          <nav
            aria-label="Navegação de datas"
            className="inline-flex items-center rounded-md border border-border-default bg-bg-surface p-0.5 [box-shadow:var(--shadow-xs)]"
          >
            <Link
              href={`/app/agenda?date=${prevDate.toISOString().slice(0, 10)}`}
              aria-label="Dia anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={1.75} />
            </Link>
            <Link
              href={`/app/agenda?date=${todayStr}`}
              className={
                "inline-flex h-8 items-center justify-center rounded-sm px-3 text-tiny font-medium transition-colors " +
                (isToday
                  ? "bg-brand-primary text-white"
                  : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
              }
            >
              Hoje
            </Link>
            <Link
              href={`/app/agenda?date=${nextDate.toISOString().slice(0, 10)}`}
              aria-label="Próximo dia"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-bg-subtle hover:text-text-primary"
            >
              <ChevronRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </nav>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AppointmentList appointments={data.appointments} />
          </div>
          <div>
            <NewAppointmentForm
              patients={data.patients}
              defaultDate={targetDate}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
