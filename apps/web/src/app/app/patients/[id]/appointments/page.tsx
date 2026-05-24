import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  CalendarPlus,
  Video,
  Phone,
  MapPin,
  CircleCheck,
  XCircle,
  Clock,
  Calendar,
  TrendingUp,
  UserX,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { Badge } from "@repo/ui/badge";

export const dynamic = "force-dynamic";
export const metadata = { title: "Histórico de consultas" };

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  CHECKED_IN: "Check-in feito",
  COMPLETED: "Realizada",
  CANCELLED: "Cancelada",
  NO_SHOW: "Falta",
};

const MODALITY_LABEL: Record<string, string> = {
  in_person: "Presencial",
  video: "Vídeo",
  phone: "Telefone",
};

const STATUS_VARIANT: Record<
  string,
  "success" | "neutral" | "warning" | "error" | "info"
> = {
  SCHEDULED: "info",
  CONFIRMED: "info",
  CHECKED_IN: "success",
  COMPLETED: "success",
  CANCELLED: "neutral",
  NO_SHOW: "warning",
};

function ModalityIcon({ modality }: { modality: string }) {
  if (modality === "video")
    return <Video className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />;
  if (modality === "phone")
    return <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />;
  return <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />;
}

function durationMin(start: Date, end: Date): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
  );
}

export default async function PatientAppointmentsPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string };
    appointments: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
      modality: string;
      timezone: string;
      notes: string | null;
      meetingUrl: string | null;
      cancellationReason: string | null;
      payment: {
        amountCents: number;
        status: string;
        externalPaymentMethod: string | null;
      } | null;
    }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;

      const appointments = (await tx.appointment.findMany({
        where: { patientId: id },
        orderBy: { startsAt: "desc" },
        take: 200,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          modality: true,
          timezone: true,
          notes: true,
          meetingUrl: true,
          cancellationReason: true,
        },
      })) as Array<{
        id: string;
        startsAt: Date;
        endsAt: Date;
        status: string;
        modality: string;
        timezone: string;
        notes: string | null;
        meetingUrl: string | null;
        cancellationReason: string | null;
      }>;

      // Buscar pagamentos vinculados a cada consulta
      const appointmentIds = appointments.map((a) => a.id);
      const payments =
        appointmentIds.length > 0
          ? ((await tx.patientPayment.findMany({
              where: { appointmentId: { in: appointmentIds } },
              select: {
                appointmentId: true,
                amountCents: true,
                status: true,
                externalPaymentMethod: true,
              },
            })) as Array<{
              appointmentId: string | null;
              amountCents: number;
              status: string;
              externalPaymentMethod: string | null;
            }>)
          : [];

      const paymentByAppointment = new Map(
        payments.map((p) => [p.appointmentId, p]),
      );

      return {
        patient,
        appointments: appointments.map((a) => ({
          ...a,
          payment: paymentByAppointment.get(a.id) ?? null,
        })),
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();
  const { patient, appointments } = data;

  const now = new Date();

  // ── Stats ────────────────────────────────────────────────────────────────
  const total = appointments.length;
  const completed = appointments.filter((a) => a.status === "COMPLETED").length;
  const upcoming = appointments.filter(
    (a) =>
      new Date(a.startsAt) >= now &&
      a.status !== "CANCELLED" &&
      a.status !== "NO_SHOW",
  ).length;
  const noShows = appointments.filter((a) => a.status === "NO_SHOW").length;
  const cancellations = appointments.filter(
    (a) => a.status === "CANCELLED",
  ).length;

  // Taxa de comparecimento (excluindo futuros e agendados sem resposta)
  const finalized = completed + noShows;
  const attendanceRate =
    finalized > 0 ? Math.round((completed / finalized) * 100) : null;

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-5xl">
        {/* Breadcrumb */}
        <Link
          href={`/app/patients/${id}`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {patient.fullName}
        </Link>

        {/* Header */}
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-h1 font-bold text-text-primary">
              Histórico de consultas
            </h1>
            <p className="mt-0.5 text-body text-text-muted">
              {total === 0
                ? "Nenhuma consulta registrada ainda."
                : `${total} consulta${total !== 1 ? "s" : ""} no total`}
            </p>
          </div>
          <Link
            href={`/app/agenda?patientId=${id}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-3 text-body font-medium text-white transition-opacity hover:opacity-90"
          >
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
            Agendar consulta
          </Link>
        </div>

        {/* Stats */}
        {total > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard
              label="Total"
              value={total}
              icon={<Calendar className="h-4 w-4" strokeWidth={1.75} />}
            />
            <StatCard
              label="Realizadas"
              value={completed}
              icon={
                <CircleCheck
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
                />
              }
            />
            <StatCard
              label="Próximas"
              value={upcoming}
              icon={
                <Clock
                  className="h-4 w-4 text-brand-primary"
                  strokeWidth={1.75}
                />
              }
            />
            <StatCard
              label="Faltas"
              value={noShows}
              icon={
                <UserX className="h-4 w-4 text-warning" strokeWidth={1.75} />
              }
            />
            <StatCard
              label="Taxa de comparecimento"
              value={attendanceRate !== null ? `${attendanceRate}%` : "—"}
              icon={
                <TrendingUp
                  className="h-4 w-4 text-success"
                  strokeWidth={1.75}
                />
              }
              sub={
                cancellations > 0
                  ? `${cancellations} cancelamento${cancellations !== 1 ? "s" : ""}`
                  : undefined
              }
            />
          </div>
        )}

        {/* Table */}
        {total === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-default py-12 text-center">
            <Calendar
              className="h-10 w-10 text-text-muted"
              strokeWidth={1.25}
            />
            <p className="text-body font-medium text-text-secondary">
              Nenhuma consulta cadastrada para este paciente
            </p>
            <Link
              href={`/app/agenda?patientId=${id}`}
              className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-primary px-3 text-body font-medium text-white transition-opacity hover:opacity-90"
            >
              <CalendarPlus className="h-4 w-4" strokeWidth={1.75} />
              Agendar primeira consulta
            </Link>
          </div>
        ) : (
          <section className="mt-6 overflow-hidden rounded-xl border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
            <table className="w-full text-body">
              <thead className="border-b border-border-subtle bg-bg-subtle">
                <tr>
                  <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Data / Hora
                  </th>
                  <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Modalidade
                  </th>
                  <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Duração
                  </th>
                  <th className="px-4 py-3 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Pagamento
                  </th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {appointments.map((appt) => {
                  const start = new Date(appt.startsAt);
                  const isPast = start < now;
                  const dur = durationMin(appt.startsAt, appt.endsAt);

                  return (
                    <tr
                      key={appt.id}
                      className="group transition-colors hover:bg-bg-subtle"
                    >
                      {/* Data / Hora */}
                      <td className="px-4 py-3">
                        <p className="font-medium text-text-primary">
                          {start.toLocaleDateString("pt-BR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-tiny text-text-muted">
                          {start.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      {/* Modalidade */}
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-text-secondary">
                          <ModalityIcon modality={appt.modality} />
                          {MODALITY_LABEL[appt.modality] ?? appt.modality}
                        </span>
                        {appt.meetingUrl && !isPast && (
                          <a
                            href={appt.meetingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block text-tiny text-brand-primary underline-offset-2 hover:underline"
                          >
                            Abrir link
                          </a>
                        )}
                      </td>

                      {/* Duração */}
                      <td className="px-4 py-3 text-tiny text-text-secondary">
                        {dur}min
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <Badge
                          variant={STATUS_VARIANT[appt.status] ?? "neutral"}
                        >
                          {STATUS_LABEL[appt.status] ?? appt.status}
                        </Badge>
                        {appt.cancellationReason && (
                          <p className="mt-0.5 max-w-[180px] truncate text-tiny text-text-muted">
                            {appt.cancellationReason}
                          </p>
                        )}
                      </td>

                      {/* Pagamento */}
                      <td className="px-4 py-3 text-right">
                        {appt.payment ? (
                          <div>
                            <p className="tabular-nums font-medium text-text-primary">
                              {(appt.payment.amountCents / 100).toLocaleString(
                                "pt-BR",
                                { style: "currency", currency: "BRL" },
                              )}
                            </p>
                            <p className="text-tiny text-text-muted">
                              {appt.payment.externalPaymentMethod ?? "—"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-tiny text-text-muted">—</span>
                        )}
                      </td>

                      {/* Ação: ir para agenda no dia */}
                      <td className="px-2 py-3 text-center">
                        <Link
                          href={`/app/agenda?date=${start.toISOString().slice(0, 10)}`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded text-text-muted opacity-0 transition-opacity hover:bg-bg-surface-hover hover:text-text-primary group-hover:opacity-100"
                          title="Ver no calendário"
                        >
                          <Calendar
                            className="h-3.5 w-3.5"
                            strokeWidth={1.75}
                          />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        {/* Notas de consultas com anotações */}
        {appointments.some((a) => a.notes) && (
          <section className="mt-6 rounded-xl border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
            <h2 className="mb-3 text-h3 font-semibold text-text-primary">
              Observações registradas
            </h2>
            <div className="space-y-3">
              {appointments
                .filter((a) => a.notes)
                .slice(0, 10)
                .map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-border-subtle p-3"
                  >
                    <p className="mb-1 text-tiny font-medium text-text-muted">
                      {new Date(a.startsAt).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      ·{" "}
                      <span className="capitalize">
                        {MODALITY_LABEL[a.modality] ?? a.modality}
                      </span>
                    </p>
                    <p className="text-body text-text-secondary">{a.notes}</p>
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Empty upcoming */}
        {upcoming === 0 && total > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-border-subtle bg-info-bg px-4 py-3">
            <XCircle
              className="h-4 w-4 shrink-0 text-info"
              strokeWidth={1.75}
            />
            <p className="text-body text-info">
              Nenhuma consulta futura agendada.{" "}
              <Link
                href={`/app/agenda?patientId=${id}`}
                className="font-medium underline underline-offset-2"
              >
                Agendar agora
              </Link>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]">
      <div className="flex items-center justify-between">
        <p className="text-tiny text-text-muted">{label}</p>
        {icon}
      </div>
      <p className="mt-1 text-h2 font-bold text-text-primary">{value}</p>
      {sub && <p className="text-tiny text-text-muted">{sub}</p>}
    </div>
  );
}
