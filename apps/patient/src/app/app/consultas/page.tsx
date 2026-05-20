import {
  MapPin,
  Video,
  Phone,
  Hospital,
  Calendar,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { StatusDot } from "@repo/ui/status-dot";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultas — NutriCore" };

type StatusVariant =
  | "info"
  | "primary"
  | "success"
  | "neutral"
  | "warning"
  | "danger";
type DotStatus = "info" | "active" | "warning" | "danger" | "inactive";

interface StatusInfo {
  label: string;
  variant: StatusVariant;
  dot: DotStatus;
  pulse?: boolean;
}

const STATUS_INFO: Record<string, StatusInfo> = {
  SCHEDULED: { label: "Agendada", variant: "info", dot: "info" },
  CONFIRMED: {
    label: "Confirmada",
    variant: "primary",
    dot: "active",
    pulse: true,
  },
  CHECKED_IN: {
    label: "Em andamento",
    variant: "info",
    dot: "info",
    pulse: true,
  },
  COMPLETED: { label: "Realizada", variant: "success", dot: "active" },
  CANCELLED: { label: "Cancelada", variant: "neutral", dot: "inactive" },
  NO_SHOW: { label: "Não compareci", variant: "danger", dot: "danger" },
};

const MODALITY: Record<string, { Icon: LucideIcon; label: string }> = {
  in_person: { Icon: MapPin, label: "Presencial" },
  video: { Icon: Video, label: "Vídeo" },
  phone: { Icon: Phone, label: "Telefone" },
};

const VARIANT_CLASS: Record<StatusVariant, string> = {
  neutral: "bg-bg-subtle text-text-secondary ring-border-subtle",
  info: "bg-info-bg text-info ring-info-border",
  primary: "bg-brand-primary-bg text-brand-primary-hover ring-brand-200",
  success: "bg-success-bg text-success ring-success-border",
  warning: "bg-warning-bg text-warning ring-warning-border",
  danger: "bg-danger-bg text-danger ring-danger-border",
};

export default async function PatientAppointmentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Lock 6 — busca pacientes vinculados a este user em todas as orgs
  const patients = await prisma.patient.findMany({
    where: { userId: user!.id },
    select: { id: true, organizationId: true },
  });
  const patientIds = patients.map((p) => p.id);
  const orgIds = Array.from(new Set(patients.map((p) => p.organizationId)));

  const [rawAppointments, orgs] = patientIds.length
    ? await Promise.all([
        prisma.appointment.findMany({
          where: { patientId: { in: patientIds } },
          orderBy: { startsAt: "desc" },
          take: 50,
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            modality: true,
            notes: true,
            patientId: true,
            organizationId: true,
          },
        }),
        prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, name: true },
        }),
      ])
    : [[], []];

  const orgMap = new Map(orgs.map((o) => [o.id, o.name]));
  const appointments = rawAppointments.map((a) => ({
    ...a,
    organizationName: orgMap.get(a.organizationId) ?? "—",
  }));

  const nowMs = new Date().getTime();
  const future = appointments.filter(
    (a) =>
      a.startsAt.getTime() >= nowMs &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status),
  );
  const past = appointments.filter(
    (a) =>
      a.startsAt.getTime() < nowMs ||
      ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status),
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Sua agenda
      </p>
      <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
        Consultas
      </h1>
      <p className="mt-1 text-caption text-text-secondary tabular-nums">
        {appointments.length} consulta{appointments.length === 1 ? "" : "s"} ao
        todo
      </p>

      {appointments.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
            <Calendar className="h-5 w-5" strokeWidth={1.75} />
          </div>
          <p className="mt-3 text-h3 font-semibold text-text-primary">
            Nenhuma consulta agendada
          </p>
          <p className="mt-1 text-caption text-text-secondary">
            Quando sua(seu) nutricionista agendar uma consulta, ela aparecerá
            aqui.
          </p>
        </div>
      ) : (
        <>
          {future.length > 0 && (
            <section className="mt-6">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Próximas ({future.length})
              </h2>
              <ul className="mt-2 space-y-2.5">
                {future.map((a) => (
                  <AppointmentItem key={a.id} appointment={a} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Histórico ({past.length})
              </h2>
              <ul className="mt-2 space-y-2.5">
                {past.map((a) => (
                  <AppointmentItem key={a.id} appointment={a} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function AppointmentItem({
  appointment: a,
}: {
  appointment: {
    id: string;
    startsAt: Date;
    endsAt: Date;
    status: string;
    modality: string;
    notes: string | null;
    organizationName: string;
  };
}) {
  const info = STATUS_INFO[a.status] ?? {
    label: a.status,
    variant: "neutral" as const,
    dot: "inactive" as const,
  };
  const mod = MODALITY[a.modality];
  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);
  const isPast = a.status === "COMPLETED" || a.status === "CANCELLED";

  return (
    <li
      className={
        "rounded-lg border bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] transition-all duration-fast " +
        (isPast
          ? "border-border-subtle opacity-80"
          : "border-border-subtle hover:[box-shadow:var(--shadow-sm)]")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Date block */}
          <div className="flex min-w-[56px] flex-col items-center rounded-md bg-bg-subtle px-2 py-2 text-text-primary">
            <span className="text-tiny font-medium uppercase tracking-wider text-text-muted">
              {start
                .toLocaleDateString("pt-BR", { month: "short" })
                .slice(0, 3)}
            </span>
            <span className="text-h2 font-semibold tabular-nums leading-none">
              {start.getDate()}
            </span>
            <span className="mt-0.5 text-tiny font-medium tabular-nums text-text-secondary">
              {start.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-body font-medium text-text-primary tabular-nums">
                {start.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                {" – "}
                {end.toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
              <span
                className={
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                  VARIANT_CLASS[info.variant]
                }
              >
                <StatusDot status={info.dot} pulse={info.pulse} size={1.5} />
                {info.label}
              </span>
            </div>
            {mod && (
              <p className="mt-1 inline-flex items-center gap-1 text-caption text-text-muted">
                <mod.Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                {mod.label}
              </p>
            )}
            <p className="mt-1 inline-flex items-center gap-1 text-tiny text-text-muted">
              <Hospital className="h-3 w-3" strokeWidth={1.75} />
              {a.organizationName}
            </p>
            {a.notes && (
              <p className="mt-1 text-caption italic text-text-secondary">
                &ldquo;{a.notes}&rdquo;
              </p>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}
