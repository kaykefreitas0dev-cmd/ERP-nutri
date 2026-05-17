"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentStatusAction } from "./actions";

interface Appointment {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
  modality: string;
  patientName: string | null;
  externalPatientName: string | null;
  notes: string | null;
}

interface Props {
  appointments: Appointment[];
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: "Agendado", color: "bg-blue-100 text-blue-800" },
  CONFIRMED: { label: "Confirmado", color: "bg-teal-100 text-teal-800" },
  CHECKED_IN: { label: "Check-in", color: "bg-purple-100 text-purple-800" },
  COMPLETED: { label: "Realizada", color: "bg-green-100 text-green-800" },
  CANCELLED: { label: "Cancelada", color: "bg-slate-200 text-slate-600" },
  NO_SHOW: { label: "No-show", color: "bg-red-100 text-red-800" },
};

const MODALITY_ICON: Record<string, string> = {
  in_person: "📍",
  video: "📹",
  phone: "📞",
};

export function AppointmentList({ appointments }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  function updateStatus(
    appointmentId: string,
    toStatus: Parameters<typeof updateAppointmentStatusAction>[0]["toStatus"],
  ) {
    setUpdatingId(appointmentId);
    startTransition(async () => {
      const result = await updateAppointmentStatusAction({ appointmentId, toStatus });
      setUpdatingId(null);
      if (!result.ok) alert(result.message);
      else router.refresh();
    });
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-600">Nenhuma consulta agendada para este dia.</p>
        <p className="mt-2 text-sm text-slate-500">
          Use o formulário ao lado para criar uma nova.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {appointments.map((apt) => {
        const start = new Date(apt.startsAt);
        const end = new Date(apt.endsAt);
        const statusInfo = STATUS_LABEL[apt.status] ?? { label: apt.status, color: "bg-slate-100" };
        const patientName =
          apt.patientName ?? apt.externalPatientName ?? "(sem paciente)";

        return (
          <li
            key={apt.id}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">
                    {start.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="text-sm text-slate-500">
                    – {end.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.color}`}
                  >
                    {statusInfo.label}
                  </span>
                  <span aria-hidden className="text-base">
                    {MODALITY_ICON[apt.modality] ?? ""}
                  </span>
                </div>
                <div className="mt-1 font-medium text-slate-900">{patientName}</div>
                {apt.notes && (
                  <p className="mt-1 text-sm text-slate-600">{apt.notes}</p>
                )}
              </div>

              <div className="flex flex-col gap-1">
                {apt.status === "SCHEDULED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(apt.id, "CONFIRMED")}
                      disabled={pending && updatingId === apt.id}
                      className="rounded-md bg-teal-700 px-3 py-1 text-xs font-medium text-white hover:bg-teal-800 disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(apt.id, "CANCELLED")}
                      disabled={pending && updatingId === apt.id}
                      className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {apt.status === "CONFIRMED" && (
                  <>
                    <button
                      type="button"
                      onClick={() => updateStatus(apt.id, "CHECKED_IN")}
                      disabled={pending && updatingId === apt.id}
                      className="rounded-md bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      Check-in
                    </button>
                    <button
                      type="button"
                      onClick={() => updateStatus(apt.id, "NO_SHOW")}
                      disabled={pending && updatingId === apt.id}
                      className="rounded-md border border-red-300 bg-white px-3 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      No-show
                    </button>
                  </>
                )}
                {(apt.status === "CHECKED_IN" || apt.status === "CONFIRMED") && (
                  <button
                    type="button"
                    onClick={() => updateStatus(apt.id, "COMPLETED")}
                    disabled={pending && updatingId === apt.id}
                    className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    Marcar realizada
                  </button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
