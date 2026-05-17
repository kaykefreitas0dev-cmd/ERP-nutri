"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { scheduleAppointmentAction } from "./actions";

interface Props {
  patients: Array<{ id: string; fullName: string }>;
  defaultDate: Date;
}

export function NewAppointmentForm({ patients, defaultDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [patientMode, setPatientMode] = useState<"existing" | "external">(
    "existing",
  );

  // Default: próxima hora cheia
  const next = new Date(defaultDate);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const defaultDateTime = next.toISOString().slice(0, 16);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await scheduleAppointmentAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Nova consulta</h2>

      {error && (
        <div
          role="alert"
          className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-2 rounded-md bg-success-bg p-3 text-sm text-success">
          <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
          Agendada com sucesso
        </div>
      )}

      <form action={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="startsAt" className="block text-xs font-medium">
            Data e hora *
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultDateTime}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label
            htmlFor="durationMinutes"
            className="block text-xs font-medium"
          >
            Duração (min) *
          </label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            defaultValue="60"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos</option>
            <option value="90">90 minutos</option>
            <option value="120">120 minutos</option>
          </select>
        </div>

        <div>
          <span className="block text-xs font-medium">Paciente *</span>
          <div className="mt-1 flex gap-2 text-xs">
            <button
              type="button"
              onClick={() => setPatientMode("existing")}
              className={`rounded-md px-2 py-1 ${
                patientMode === "existing"
                  ? "bg-brand-primary text-white"
                  : "border border-slate-300 bg-white"
              }`}
            >
              Existente
            </button>
            <button
              type="button"
              onClick={() => setPatientMode("external")}
              className={`rounded-md px-2 py-1 ${
                patientMode === "external"
                  ? "bg-brand-primary text-white"
                  : "border border-slate-300 bg-white"
              }`}
            >
              Externo (avulso)
            </button>
          </div>

          {patientMode === "existing" ? (
            <select
              key="patientId"
              name="patientId"
              required={patientMode === "existing"}
              defaultValue=""
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-2 space-y-2">
              <input
                key="externalName"
                name="externalPatientName"
                type="text"
                required={patientMode === "external"}
                placeholder="Nome completo"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="externalPatientEmail"
                type="email"
                placeholder="Email (opcional)"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                name="externalPatientPhone"
                type="tel"
                placeholder="Telefone (opcional)"
                className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor="modality" className="block text-xs font-medium">
            Modalidade
          </label>
          <select
            id="modality"
            name="modality"
            defaultValue="in_person"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="in_person">📍 Presencial</option>
            <option value="video">📹 Videochamada</option>
            <option value="phone">📞 Telefone</option>
          </select>
        </div>

        <div>
          <label htmlFor="notes" className="block text-xs font-medium">
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-primary px-4 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? "Agendando…" : "Agendar"}
        </button>

        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
          Anti-overlap via Postgres EXCLUDE constraint — se houver conflito,
          retorna erro.
        </p>
      </form>
    </div>
  );
}
