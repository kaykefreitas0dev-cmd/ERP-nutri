import { MapPin, Video, Phone, Hospital, type LucideIcon } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Consultas — NutriCore" };

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Agendada", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: {
    label: "Confirmada",
    color: "bg-brand-100 text-brand-primary-hover",
  },
  CHECKED_IN: { label: "Em andamento", color: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "Realizada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-slate-200 text-slate-600" },
  NO_SHOW: { label: "Não compareci", color: "bg-red-100 text-red-800" },
};

const MODALITY_ICON: Record<string, LucideIcon> = {
  in_person: MapPin,
  video: Video,
  phone: Phone,
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

  const now = new Date();
  const future = appointments.filter(
    (a) =>
      new Date(a.startsAt) >= now &&
      !["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status),
  );
  const past = appointments.filter(
    (a) =>
      new Date(a.startsAt) < now ||
      ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(a.status),
  );

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Minhas consultas</h1>
      <p className="mt-1 text-sm text-slate-600">
        {appointments.length} consulta(s) ao todo
      </p>

      {appointments.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
          Nenhuma consulta agendada ainda.
        </div>
      ) : (
        <>
          {future.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-slate-700">
                Próximas ({future.length})
              </h2>
              <ul className="mt-2 space-y-2">
                {future.map((a) => (
                  <AppointmentItem key={a.id} appointment={a} />
                ))}
              </ul>
            </section>
          )}

          {past.length > 0 && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-slate-700">
                Histórico ({past.length})
              </h2>
              <ul className="mt-2 space-y-2">
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
  const s = STATUS_LABEL[a.status] ?? {
    label: a.status,
    color: "bg-slate-100",
  };
  const start = new Date(a.startsAt);
  const end = new Date(a.endsAt);

  return (
    <li className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold text-slate-900">
              {start.toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
            <span className="text-sm text-slate-600">
              {start.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              –{" "}
              {end.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {(() => {
              const ModIcon = MODALITY_ICON[a.modality];
              return ModIcon ? (
                <ModIcon
                  className="h-4 w-4 text-slate-500"
                  strokeWidth={1.75}
                />
              ) : null;
            })()}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
            <Hospital className="h-3.5 w-3.5" strokeWidth={1.75} />
            {a.organizationName}
          </p>
          {a.notes && (
            <p className="mt-1 text-xs text-slate-600 italic">
              &ldquo;{a.notes}&rdquo;
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.color}`}
        >
          {s.label}
        </span>
      </div>
    </li>
  );
}
